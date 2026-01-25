// Admin Products Tab Component
import { Plus, Edit, Save, X, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export default function AdminProducts({ 
  products, 
  newProduct, 
  setNewProduct, 
  editingProduct, 
  setEditingProduct,
  handleCreateProduct, 
  handleUpdateProduct, 
  handleDeleteProduct, 
  t 
}) {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">{t('admin.manageProducts')}</h1>
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">{t('admin.newProduct')}</h3>
        <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-white">{t('admin.productName')}</Label>
            <Input value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="z.B. iPhone 15 Pro" />
          </div>
          <div className="space-y-2">
            <Label className="text-white">{t('admin.category')}</Label>
            <Input value={newProduct.category} onChange={(e) => setNewProduct({...newProduct, category: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="z.B. Elektronik" />
          </div>
          <div className="space-y-2">
            <Label className="text-white">{t('admin.imageUrl')}</Label>
            <Input value={newProduct.image_url} onChange={(e) => setNewProduct({...newProduct, image_url: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label className="text-white">{t('admin.rrp')}</Label>
            <Input type="number" step="0.01" value={newProduct.retail_price} onChange={(e) => setNewProduct({...newProduct, retail_price: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="999.00" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-white">{t('admin.description')}</Label>
            <Input value={newProduct.description} onChange={(e) => setNewProduct({...newProduct, description: e.target.value})} required className="bg-[#181824] border-white/10 text-white" placeholder="Produktbeschreibung..." />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" className="btn-primary"><Plus className="w-4 h-4 mr-2" />{t('admin.createProduct')}</Button>
          </div>
        </form>
      </div>
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#181824]">
              <tr>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.image')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.productName')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.category')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.rrp')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(products || []).map((product) => (
                <tr key={product.id} className="hover:bg-white/5">
                  <td className="px-4 py-3"><img src={product.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" /></td>
                  <td className="px-4 py-3">{editingProduct?.id === product.id ? <Input value={editingProduct.name} onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})} className="bg-[#181824] border-white/10 text-white h-8" /> : <span className="text-white">{product.name}</span>}</td>
                  <td className="px-4 py-3">{editingProduct?.id === product.id ? <Input value={editingProduct.category} onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})} className="bg-[#181824] border-white/10 text-white h-8" /> : <span className="text-[#94A3B8]">{product.category}</span>}</td>
                  <td className="px-4 py-3">{editingProduct?.id === product.id ? <Input type="number" step="0.01" value={editingProduct.retail_price} onChange={(e) => setEditingProduct({...editingProduct, retail_price: parseFloat(e.target.value)})} className="bg-[#181824] border-white/10 text-white h-8 w-24" /> : <span className="text-[#06B6D4] font-mono">€{product.retail_price?.toFixed(2)}</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {editingProduct?.id === product.id ? (
                        <>
                          <Button size="sm" variant="ghost" className="text-[#10B981] hover:bg-[#10B981]/10" onClick={() => handleUpdateProduct(product.id)}><Save className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-[#94A3B8] hover:bg-white/10" onClick={() => setEditingProduct(null)}><X className="w-4 h-4" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="text-[#7C3AED] hover:bg-[#7C3AED]/10" onClick={() => setEditingProduct({...product})}><Edit className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => handleDeleteProduct(product.id)}><Trash2 className="w-4 h-4" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
