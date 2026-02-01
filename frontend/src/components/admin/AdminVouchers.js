// Admin Vouchers Tab Component - with Bulk Creation and Euro Values
import { useState } from 'react';
import { Ticket, Plus, ToggleLeft, ToggleRight, Trash2, Copy, Download, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';

export default function AdminVouchers({ 
  vouchers, 
  newVoucher, 
  setNewVoucher,
  handleCreateVoucher, 
  handleToggleVoucher,
  handleDeleteVoucher,
  t,
  token,
  API,
  fetchVouchers
}) {
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkPrefix, setBulkPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCodes, setCreatedCodes] = useState([]);

  // Handle single voucher creation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${API}/admin/vouchers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code: newVoucher.code || null,
          type: newVoucher.type,
          value: parseInt(newVoucher.value),
          max_uses: parseInt(newVoucher.max_uses) || 1,
          expires_days: 30
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Fehler beim Erstellen');
      }
      
      const data = await response.json();
      toast.success(`Gutschein ${data.code} erstellt!`);
      setNewVoucher({ code: '', type: 'bids', value: '10', max_uses: '1' });
      if (fetchVouchers) fetchVouchers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle bulk voucher creation
  const handleBulkCreate = async () => {
    setLoading(true);
    setCreatedCodes([]);
    
    try {
      const response = await fetch(`${API}/admin/vouchers/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          count: bulkCount,
          type: newVoucher.type,
          value: parseInt(newVoucher.value),
          max_uses: parseInt(newVoucher.max_uses) || 1,
          expires_days: 30,
          prefix: bulkPrefix
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Fehler beim Erstellen');
      }
      
      const data = await response.json();
      toast.success(data.message);
      setCreatedCodes(data.codes || []);
      if (fetchVouchers) fetchVouchers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Copy all codes to clipboard
  const copyAllCodes = () => {
    navigator.clipboard.writeText(createdCodes.join('\n'));
    toast.success('Alle Codes kopiert!');
  };

  // Download codes as CSV
  const downloadCodes = () => {
    const csv = 'Code,Typ,Wert\n' + createdCodes.map(code => 
      `${code},${newVoucher.type},${newVoucher.value}`
    ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gutscheine_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV heruntergeladen!');
  };

  // Get display value based on type
  const getDisplayValue = (voucher) => {
    if (voucher.type === 'euro') {
      return `€${voucher.value} (${voucher.bids} Gebote)`;
    } else if (voucher.type === 'bids') {
      return `${voucher.value || voucher.bids} Gebote`;
    } else if (voucher.type === 'discount') {
      return `${voucher.value}% Rabatt`;
    }
    return `${voucher.bids || voucher.value} Gebote`;
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white flex items-center gap-3">
        <Ticket className="w-8 h-8 text-[#EC4899]" />
        {t('admin.manageVouchers')}
      </h1>
      
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button 
          variant={!bulkMode ? "default" : "outline"}
          onClick={() => setBulkMode(false)}
          className={!bulkMode ? "bg-[#EC4899]" : ""}
        >
          Einzeln erstellen
        </Button>
        <Button 
          variant={bulkMode ? "default" : "outline"}
          onClick={() => setBulkMode(true)}
          className={bulkMode ? "bg-[#EC4899]" : ""}
        >
          Mehrere erstellen
        </Button>
      </div>
      
      {/* Create Voucher Form */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">
          {bulkMode ? 'Mehrere Gutscheine erstellen' : t('admin.newVoucher')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Code (only for single mode) */}
          {!bulkMode && (
            <div className="space-y-2">
              <Label className="text-white">{t('admin.voucherCode')}</Label>
              <Input 
                value={newVoucher.code} 
                onChange={(e) => setNewVoucher({...newVoucher, code: e.target.value.toUpperCase()})} 
                className="bg-[#181824] border-white/10 text-white font-mono" 
                placeholder="AUTO (leer lassen)" 
              />
              <p className="text-xs text-gray-500">Leer = Auto-Generierung</p>
            </div>
          )}
          
          {/* Prefix and Count (only for bulk mode) */}
          {bulkMode && (
            <>
              <div className="space-y-2">
                <Label className="text-white">Anzahl</Label>
                <Input 
                  type="number" 
                  value={bulkCount} 
                  onChange={(e) => setBulkCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))} 
                  className="bg-[#181824] border-white/10 text-white" 
                  placeholder="10" 
                  min="1"
                  max="100"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Prefix (optional)</Label>
                <Input 
                  value={bulkPrefix} 
                  onChange={(e) => setBulkPrefix(e.target.value.toUpperCase())} 
                  className="bg-[#181824] border-white/10 text-white font-mono" 
                  placeholder="z.B. NEUJAHR" 
                />
              </div>
            </>
          )}
          
          {/* Type */}
          <div className="space-y-2">
            <Label className="text-white">{t('admin.voucherType')}</Label>
            <Select value={newVoucher.type} onValueChange={(value) => setNewVoucher({...newVoucher, type: value})}>
              <SelectTrigger className="bg-[#181824] border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#181824] border-white/10">
                <SelectItem value="bids" className="text-white hover:bg-white/10">Gebote</SelectItem>
                <SelectItem value="euro" className="text-white hover:bg-white/10">Euro-Wert (€)</SelectItem>
                <SelectItem value="discount" className="text-white hover:bg-white/10">Rabatt (%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Value */}
          <div className="space-y-2">
            <Label className="text-white">
              {newVoucher.type === 'bids' ? 'Anzahl Gebote' : 
               newVoucher.type === 'euro' ? 'Euro-Wert (€)' : 
               'Rabatt (%)'}
            </Label>
            <Input 
              type="number" 
              value={newVoucher.value} 
              onChange={(e) => setNewVoucher({...newVoucher, value: e.target.value})} 
              required 
              className="bg-[#181824] border-white/10 text-white" 
              placeholder={newVoucher.type === 'bids' ? '50' : newVoucher.type === 'euro' ? '10' : '20'} 
            />
            {newVoucher.type === 'euro' && (
              <p className="text-xs text-green-400">= {parseInt(newVoucher.value || 0) * 5} Gebote</p>
            )}
          </div>
          
          {/* Max Uses */}
          <div className="space-y-2">
            <Label className="text-white">Max. Einlösungen</Label>
            <Input 
              type="number" 
              value={newVoucher.max_uses || '1'} 
              onChange={(e) => setNewVoucher({...newVoucher, max_uses: e.target.value})} 
              className="bg-[#181824] border-white/10 text-white" 
              placeholder="1" 
              min="1"
            />
          </div>
          
          {/* Submit Button */}
          <div className="space-y-2">
            <Label className="text-white">&nbsp;</Label>
            {bulkMode ? (
              <Button 
                onClick={handleBulkCreate} 
                className="w-full btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {bulkCount} Gutscheine erstellen
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                className="w-full btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {t('admin.createVoucher')}
              </Button>
            )}
          </div>
        </div>
        
        {/* Quick Value Buttons for Euro */}
        {newVoucher.type === 'euro' && (
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="text-gray-400 text-sm self-center">Schnellwahl:</span>
            {[5, 10, 15, 20, 25, 50].map(val => (
              <Button 
                key={val}
                size="sm"
                variant="outline"
                onClick={() => setNewVoucher({...newVoucher, value: val.toString()})}
                className={newVoucher.value === val.toString() ? 'bg-[#EC4899]/20 border-[#EC4899]' : ''}
              >
                €{val}
              </Button>
            ))}
          </div>
        )}
        
        {/* Quick Value Buttons for Bids */}
        {newVoucher.type === 'bids' && (
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="text-gray-400 text-sm self-center">Schnellwahl:</span>
            {[10, 25, 50, 100, 200, 500].map(val => (
              <Button 
                key={val}
                size="sm"
                variant="outline"
                onClick={() => setNewVoucher({...newVoucher, value: val.toString()})}
                className={newVoucher.value === val.toString() ? 'bg-[#EC4899]/20 border-[#EC4899]' : ''}
              >
                {val} Gebote
              </Button>
            ))}
          </div>
        )}
      </div>
      
      {/* Created Codes (after bulk creation) */}
      {createdCodes.length > 0 && (
        <div className="glass-card rounded-xl p-6 border border-green-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-green-400">
              ✅ {createdCodes.length} Gutscheine erstellt!
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyAllCodes}>
                <Copy className="w-4 h-4 mr-2" />
                Alle kopieren
              </Button>
              <Button size="sm" variant="outline" onClick={downloadCodes}>
                <Download className="w-4 h-4 mr-2" />
                CSV Download
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-60 overflow-y-auto">
            {createdCodes.map((code, idx) => (
              <div 
                key={idx}
                className="font-mono text-sm bg-[#181824] px-3 py-2 rounded text-[#EC4899] cursor-pointer hover:bg-white/5"
                onClick={() => {
                  navigator.clipboard.writeText(code);
                  toast.success(`${code} kopiert!`);
                }}
              >
                {code}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vouchers List */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#181824]">
              <tr>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.voucherCode')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.voucherType')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.value')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.used')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.status')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(vouchers || []).map((voucher) => (
                <tr key={voucher.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <span 
                      className="font-mono text-[#EC4899] bg-[#EC4899]/10 px-2 py-1 rounded cursor-pointer hover:bg-[#EC4899]/20"
                      onClick={() => {
                        navigator.clipboard.writeText(voucher.code);
                        toast.success(`${voucher.code} kopiert!`);
                      }}
                    >
                      {voucher.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      voucher.type === 'euro' ? 'bg-green-500/20 text-green-400' :
                      voucher.type === 'discount' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {voucher.type === 'euro' ? '€ Euro' : 
                       voucher.type === 'discount' ? '% Rabatt' : 
                       '🎯 Gebote'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[#06B6D4] font-bold">
                      {getDisplayValue(voucher)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[#94A3B8]">
                      {voucher.used_count || 0} / {voucher.max_uses || 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      voucher.is_active !== false ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                    }`}>
                      {voucher.is_active !== false ? t('admin.active') : t('admin.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className={voucher.is_active !== false ? "text-[#F59E0B] hover:bg-[#F59E0B]/10" : "text-[#10B981] hover:bg-[#10B981]/10"} 
                        onClick={() => handleToggleVoucher(voucher.id)}
                      >
                        {voucher.is_active !== false ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-[#EF4444] hover:bg-[#EF4444]/10" 
                        onClick={() => handleDeleteVoucher(voucher.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(vouchers || []).length === 0 && (
          <p className="text-center text-[#94A3B8] py-8">Keine Gutscheine vorhanden</p>
        )}
      </div>
    </div>
  );
}
