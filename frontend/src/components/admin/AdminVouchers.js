// Admin Vouchers Tab Component
import { Ticket, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export default function AdminVouchers({ 
  vouchers, 
  newVoucher, 
  setNewVoucher,
  handleCreateVoucher, 
  handleToggleVoucher,
  handleDeleteVoucher,
  t 
}) {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white flex items-center gap-3">
        <Ticket className="w-8 h-8 text-[#EC4899]" />
        {t('admin.manageVouchers')}
      </h1>
      
      {/* Create Voucher Form */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">{t('admin.newVoucher')}</h3>
        <form onSubmit={handleCreateVoucher} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-white">{t('admin.voucherCode')}</Label>
            <Input 
              value={newVoucher.code} 
              onChange={(e) => setNewVoucher({...newVoucher, code: e.target.value.toUpperCase()})} 
              required 
              className="bg-[#181824] border-white/10 text-white font-mono" 
              placeholder="WELCOME50" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white">{t('admin.voucherType')}</Label>
            <Select value={newVoucher.type} onValueChange={(value) => setNewVoucher({...newVoucher, type: value})}>
              <SelectTrigger className="bg-[#181824] border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#181824] border-white/10">
                <SelectItem value="bids" className="text-white hover:bg-white/10">Gebote</SelectItem>
                <SelectItem value="discount" className="text-white hover:bg-white/10">Rabatt (%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-white">{newVoucher.type === 'bids' ? t('admin.numberOfBids') : t('admin.discountPercent')}</Label>
            <Input 
              type="number" 
              value={newVoucher.value} 
              onChange={(e) => setNewVoucher({...newVoucher, value: e.target.value})} 
              required 
              className="bg-[#181824] border-white/10 text-white" 
              placeholder={newVoucher.type === 'bids' ? '50' : '20'} 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white">&nbsp;</Label>
            <Button type="submit" className="w-full btn-primary">
              <Plus className="w-4 h-4 mr-2" />{t('admin.createVoucher')}
            </Button>
          </div>
        </form>
      </div>

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
                    <span className="font-mono text-[#EC4899] bg-[#EC4899]/10 px-2 py-1 rounded">{voucher.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white">{voucher.type === 'bids' ? 'Gebote' : 'Rabatt'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[#06B6D4] font-bold">
                      {voucher.type === 'bids' ? `${voucher.value} Gebote` : `${voucher.value}%`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[#94A3B8]">{voucher.times_used || 0}x</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${voucher.is_active ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'}`}>
                      {voucher.is_active ? t('admin.active') : t('admin.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className={voucher.is_active ? "text-[#F59E0B] hover:bg-[#F59E0B]/10" : "text-[#10B981] hover:bg-[#10B981]/10"} 
                        onClick={() => handleToggleVoucher(voucher.id)}
                      >
                        {voucher.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
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
