(function () {
 'use strict';
 function customerNavigation(shell) {
  return Array.prototype.find.call(shell.querySelectorAll('.sidebarScroll nav button'), function (button) {
   var label = button.querySelector('.navLabel');
   return /^(Kunden|Customers|Klient[eë]t)$/i.test((label ? label.textContent : button.textContent).trim());
  });
 }
 function reconcile() {
  var shell = document.querySelector('.appShell[data-app-role="admin"]');
  var existing = document.querySelector('[data-testid="trade-admin-customer-entry"]');
  if (!shell) { if (existing) existing.remove(); return; }
  var main = shell.querySelector('.appMain');
  if (!main) return;
  var target = customerNavigation(shell);
  if (!existing) {
   existing = document.createElement('section');existing.setAttribute('data-testid','trade-admin-customer-entry');
   existing.style.cssText='display:block;box-sizing:border-box;max-width:100%;margin:12px;padding:16px;background:#102841;color:#fff;border:1px solid #4b82b5;border-radius:14px;font:16px/1.5 system-ui;overflow-wrap:anywhere';
   var heading=document.createElement('h2');heading.textContent='Trade BidBlitz · Admin';heading.style.cssText='display:block;margin:0 0 10px;color:#fff;font:700 20px/1.4 system-ui';
   var button=document.createElement('button');button.type='button';button.textContent='Kunden · Sperren / Entsperren';button.setAttribute('data-testid','trade-admin-open-customers');
   button.style.cssText='display:block;box-sizing:border-box;max-width:100%;min-height:44px;padding:12px 16px;background:#fff;color:#102841;border:0;border-radius:9px;font:700 15px/1.4 system-ui;white-space:normal;cursor:pointer';
   button.addEventListener('click',function(){var current=document.querySelector('.appShell[data-app-role="admin"]');var native=current&&customerNavigation(current);if(native)native.click();});
   var note=document.createElement('p');note.textContent='Kundenstatus, Lizenzbefreiung und Freimonate verwaltest du im Kundenbereich.';note.style.cssText='display:block;margin:10px 0 0;color:#d5e7fa;font:14px/1.5 system-ui';
   existing.append(heading,button,note);main.insertBefore(existing,main.querySelector('main'));
  }
  existing.querySelector('button').disabled=!target;
 }
 function start() {
  var style=document.createElement('style');style.textContent='.appShell[data-app-role="admin"] .appMain{overflow-x:clip}.appShell[data-app-role="admin"] .appMain,.appShell[data-app-role="admin"] .contentArea,.appShell[data-app-role="admin"] .adminCustomerListPanel{min-width:0;max-width:100%;box-sizing:border-box}.appShell[data-app-role="admin"] .tableWrap{min-width:0;max-width:100%;overflow-x:auto}@media(max-width:760px){.appShell[data-app-role="admin"] .sidebarScroll{min-width:0;max-width:100%;overflow-x:auto!important;overflow-y:hidden!important;box-sizing:border-box}.appShell[data-app-role="admin"] .sidebar .navLabel{display:block!important;white-space:normal;font-size:10px;line-height:1.2}.appShell[data-app-role="admin"] .sidebarScroll nav button{flex-direction:column;min-width:76px;min-height:58px;gap:4px}}.appShell[data-app-role="admin"] .errorBox{min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere}.appShell[data-app-role="admin"] .errorBox>span{min-width:0;overflow-wrap:anywhere}';document.head.appendChild(style);
  var root=document.getElementById('root');if(root)new MutationObserver(reconcile).observe(root,{childList:true,subtree:true});
  reconcile();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
