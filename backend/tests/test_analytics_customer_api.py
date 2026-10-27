"""Customer isolation contracts using the actual router and fake DB/auth."""
import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from core.analytics_customer_scope import customer_user_id, customer_site_scope
from bson import ObjectId

SITE_A = '11111111-1111-4111-8111-111111111111'
SITE_B = '22222222-2222-4222-8222-222222222222'
TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

def grant(site=SITE_A, owner='owner-a', tenant=TENANT_A, **changes):
    return dict(site_id=site, owner_user_id=owner, tenant_id=tenant,
                display_name='Mein Shop', status='active', ownership_verified=True, **changes)


@pytest.fixture
def api(monkeypatch):
    state = SimpleNamespace(user={'_id':'owner-a','role':'customer'}, auth_error=None,
                            grants=[grant(), grant(SITE_B,'owner-b',TENANT_B)],
                            metadata_queries=[], event_pipelines=[], limits=[], rows=[])
    class Cursor:
        def __init__(self,rows):self.rows=list(rows)
        def sort(self,key,direction):self.rows.sort(key=lambda row:row.get(key,''));return self
        async def to_list(self,length):return self.rows[:length]
    class Sites:
        def find(self,query,projection):
            state.metadata_queries.append(query)
            return Cursor(row for row in state.grants if all(row.get(k)==v for k,v in query.items()))
    class Events:
        def aggregate(self,pipeline):
            state.event_pipelines.append(pipeline)
            return Cursor(state.rows)
    async def current_user(request):
        if state.auth_error:raise state.auth_error
        return state.user
    database=ModuleType('core.database');database.db=SimpleNamespace(analytics_sites=Sites(),conversion_events=Events())
    security=ModuleType('core.security');security.get_current_user=current_user
    monkeypatch.setitem(sys.modules,'core.database',database);monkeypatch.setitem(sys.modules,'core.security',security)
    spec=importlib.util.spec_from_file_location('analytics_customer_api_under_test',Path(__file__).parents[1]/'routes'/'analytics.py')
    routes=importlib.util.module_from_spec(spec);spec.loader.exec_module(routes)
    app=FastAPI();app.include_router(routes.router)
    with TestClient(app) as client:yield client,state


def test_only_owned_verified_sites_are_listed(api):
    client,state=api
    body=client.get('/api/analytics/v1/my/sites').json()
    assert body=={'sites':[{'site_id':SITE_A,'display_name':'Mein Shop'}],'has_more':False}
    assert state.metadata_queries==[{'owner_user_id':'owner-a','status':'active','ownership_verified':True}]
    assert state.event_pipelines==[]


def test_customers_cannot_select_another_owner_via_request_fields(api):
    client,state=api
    response=client.get('/api/analytics/v1/my/sites',params={'owner_user_id':'owner-b','tenant_id':TENANT_B},
                        headers={'X-User-ID':'owner-b','X-Tenant-ID':TENANT_B})
    assert response.json()['sites']==[{'site_id':SITE_A,'display_name':'Mein Shop'}]


@pytest.mark.parametrize('role',['customer','admin','merchant'])
def test_foreign_site_is_404_before_event_read_even_for_admin_role(api,role):
    client,state=api;state.user['role']=role
    assert client.get(f'/api/analytics/v1/my/sites/{SITE_B}/overview').status_code==404
    assert state.event_pipelines==[]


def test_nonexistent_and_foreign_sites_have_the_same_response(api):
    client,state=api
    foreign=client.get(f'/api/analytics/v1/my/sites/{SITE_B}/overview')
    missing=client.get('/api/analytics/v1/my/sites/33333333-3333-4333-8333-333333333333/overview')
    assert foreign.status_code==missing.status_code==404
    assert foreign.json()==missing.json()


@pytest.mark.parametrize('path',['/v1/my/sites',f'/v1/my/sites/{SITE_A}/overview'])
def test_auth_failure_never_reads_metadata_or_events(api,path):
    client,state=api;state.auth_error=HTTPException(401,'Not authenticated')
    assert client.get('/api/analytics'+path).status_code==401
    assert state.metadata_queries==state.event_pipelines==[]


@pytest.mark.parametrize('changes',[{'status':'suspended'},{'ownership_verified':False},{'ownership_verified':1}])
def test_inactive_or_unverified_site_is_unavailable(api,changes):
    client,state=api;state.grants=[{**grant(),**changes}]
    assert client.get('/api/analytics/v1/my/sites').json()['sites']==[]
    assert client.get(f'/api/analytics/v1/my/sites/{SITE_A}/overview').status_code==404
    assert state.event_pipelines==[]


def test_ambiguous_site_metadata_is_not_a_grant(api):
    client,state=api;state.grants=[grant(),grant(tenant=TENANT_B)]
    assert client.get(f'/api/analytics/v1/my/sites/{SITE_A}/overview').status_code==404
    assert state.event_pipelines==[]


def test_missing_database_identity_cannot_use_claimed_user_id(api):
    client,state=api;state.user={'role':'customer','user_id':'owner-a','owner_user_id':'owner-a'}
    assert client.get('/api/analytics/v1/my/sites').status_code==403
    assert state.metadata_queries==state.event_pipelines==[]


def test_database_primary_identity_wins_over_other_identifiers():
    assert customer_user_id({'_id':'owner-a','id':'owner-b','user_id':'owner-c'})=='owner-a'
    assert customer_user_id({'id':'legacy-owner'})=='legacy-owner'
    assert customer_user_id({'_id':ObjectId('0123456789abcdef01234567')})=='0123456789abcdef01234567'


@pytest.mark.parametrize('value',[True,123,{'id':'owner-a'},['owner-a']])
def test_malformed_database_identity_is_not_coerced_to_an_owner(value):
    with pytest.raises(ValueError):customer_user_id({'_id':value})


@pytest.mark.parametrize('site',['trade','not-a-uuid','11111111111141118111111111111111','AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'])
def test_invalid_site_identifier_never_reads_metadata(api,site):
    client,state=api
    assert client.get(f'/api/analytics/v1/my/sites/{site}/overview').status_code==404
    assert state.metadata_queries==state.event_pipelines==[]


def test_customer_query_is_bound_to_both_tenant_and_site(api):
    client,state=api
    state.rows=[{'_id':{'day':'2026-10-27','event':'page_view'},'count':7,'ip':'secret'}]
    body=client.get(f'/api/analytics/v1/my/sites/{SITE_A}/overview?days=7').json()
    assert body['totals']=={'page_view':7}
    assert body['has_recorded_events'] is True
    assert body['verified_revenue_included'] is False
    assert 'owner_user_id' not in body and 'tenant_id' not in body and 'secret' not in str(body)
    match=state.event_pipelines[0][0]['$match']
    assert match['site_id']==SITE_A and match['tenant_id']==TENANT_A and match['schema_version']==1
    assert match['received_at']['$lte']==body['as_of']
    assert 'checkout_completed' not in match['event']['$in']
    assert 'first_payment' not in match['event']['$in']


def test_unbound_legacy_records_are_not_adopted_as_customer_data(api):
    client,state=api
    body=client.get(f'/api/analytics/v1/my/sites/{SITE_A}/overview').json()
    assert body['totals']=={} and body['daily']=={} and body['has_recorded_events'] is False
    assert body['data_scope']=='tenant_site_v1_events_only'
    assert state.event_pipelines[0][0]['$match']['tenant_id']==TENANT_A


@pytest.mark.parametrize('days',[0,91,'bad'])
def test_invalid_period_is_rejected_before_any_database_read(api,days):
    client,state=api
    assert client.get(f'/api/analytics/v1/my/sites/{SITE_A}/overview',params={'days':days}).status_code==422
    assert state.metadata_queries==state.event_pipelines==[]


def test_bad_grant_metadata_is_rejected_in_scope_helper():
    with pytest.raises(ValueError):customer_site_scope({**grant(),'tenant_id':'trade'},'owner-a')
    with pytest.raises(ValueError):customer_site_scope({**grant(),'display_name':'bad\nlabel'},'owner-a')
    with pytest.raises(ValueError):customer_site_scope(grant(),'owner-b')


def test_no_assignment_is_an_empty_account_not_access_to_internal_catalog(api):
    client,state=api;state.grants=[]
    assert client.get('/api/analytics/v1/my/sites').json()=={'sites':[],'has_more':False}
    assert client.get('/api/analytics/v1/portfolio').status_code==403
    assert state.event_pipelines==[]
