import { useEffect, useState, useMemo } from 'react';
import { inventoryApi } from '../../api/inventory';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../hooks/useConfirm';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WarehouseNode {
  id: string;
  name: string;
  code?: string;
  address?: string;
  isActive: boolean;
  isDefault: boolean;
  parentWarehouseId?: string | null;
  children: WarehouseNode[];
  stocks: { quantity: number; reserved: number }[];
}

interface FlatNode {
  id: string;
  name: string;
  depth: number;
}

interface EditForm {
  name: string;
  code: string;
  address: string;
  parentWarehouseId: string;
}

const EMPTY_EDIT: EditForm = { name: '', code: '', address: '', parentWarehouseId: '' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flattenTree(nodes: WarehouseNode[], depth = 0): FlatNode[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name, depth },
    ...flattenTree(n.children || [], depth + 1),
  ]);
}

function countDescendants(node: WarehouseNode): number {
  return (node.children || []).reduce((acc, c) => acc + 1 + countDescendants(c), 0);
}

function countAll(nodes: WarehouseNode[]): number {
  return nodes.reduce((acc, n) => acc + 1 + countDescendants(n), 0);
}

const up = (v: string) => v.toUpperCase();

// ─── TreeNode component ───────────────────────────────────────────────────────

interface TreeNodeProps {
  node: WarehouseNode;
  depth: number;
  flatNodes: FlatNode[];
  editingId: string | null;
  editForm: EditForm;
  addChildFor: string | null;
  childForm: EditForm;
  saving: boolean;
  onStartEdit: (node: WarehouseNode) => void;
  onCancelEdit: () => void;
  onEditChange: (f: EditForm) => void;
  onSaveEdit: (id: string) => void;
  onToggle: (node: WarehouseNode) => void;
  onSetDefault: (id: string) => void;
  onStartAddChild: (parentId: string) => void;
  onCancelAddChild: () => void;
  onChildFormChange: (f: EditForm) => void;
  onSaveChild: (parentId: string) => void;
}

function WarehouseTreeNode({
  node, depth, flatNodes,
  editingId, editForm, addChildFor, childForm, saving,
  onStartEdit, onCancelEdit, onEditChange, onSaveEdit,
  onToggle, onSetDefault,
  onStartAddChild, onCancelAddChild, onChildFormChange, onSaveChild,
}: TreeNodeProps) {
  const isRoot = depth === 0;
  const isEditing = editingId === node.id;
  const isAddingChild = addChildFor === node.id;
  const skuCount = node.stocks?.length ?? 0;
  const totalStock = node.stocks?.reduce((a, s) => a + Number(s.quantity), 0) ?? 0;
  const indentPx = Math.min(depth, 4) * 24;

  return (
    <div style={{ marginLeft: depth > 0 ? indentPx : 0 }}>
      {/* connector line for children */}
      {depth > 0 && (
        <div className="flex items-start">
          <div className="flex flex-col items-center mr-3 mt-1">
            <div className="w-px h-3 bg-surface-300 dark:bg-surface-600" />
            <div className="w-4 h-px bg-surface-300 dark:bg-surface-600" />
          </div>
          <div className="flex-1">
            <NodeBody />
          </div>
        </div>
      )}
      {depth === 0 && <NodeBody />}

      {/* Render children */}
      {!isEditing && node.children?.map((child) => (
        <WarehouseTreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          flatNodes={flatNodes}
          editingId={editingId}
          editForm={editForm}
          addChildFor={addChildFor}
          childForm={childForm}
          saving={saving}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          onEditChange={onEditChange}
          onSaveEdit={onSaveEdit}
          onToggle={onToggle}
          onSetDefault={onSetDefault}
          onStartAddChild={onStartAddChild}
          onCancelAddChild={onCancelAddChild}
          onChildFormChange={onChildFormChange}
          onSaveChild={onSaveChild}
        />
      ))}

      {/* Inline add-child form */}
      {isAddingChild && (
        <div style={{ marginLeft: Math.min(depth + 1, 4) * 24 }} className="mt-1">
          <div className="flex items-start">
            <div className="flex flex-col items-center mr-3 mt-1">
              <div className="w-px h-3 bg-cyan-700" />
              <div className="w-4 h-px bg-cyan-700" />
            </div>
            <div className="flex-1 bg-white dark:bg-surface-800 border border-brand-300 dark:border-brand-700/50 rounded-xl p-4 space-y-3 shadow-soft">
              <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">📦 NUEVA SUB-BODEGA DE "{node.name}"</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-surface-500 mb-1">Nombre *</label>
                  <input autoFocus value={childForm.name}
                    onChange={(e) => onChildFormChange({ ...childForm, name: up(e.target.value) })}
                    placeholder="ZONA A"
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" />
                </div>
                <div>
                  <label className="block text-xs text-surface-500 mb-1">Código</label>
                  <input value={childForm.code}
                    onChange={(e) => onChildFormChange({ ...childForm, code: up(e.target.value) })}
                    placeholder="ZON-A"
                    className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Dirección</label>
                <input value={childForm.address}
                  onChange={(e) => onChildFormChange({ ...childForm, address: up(e.target.value) })}
                  placeholder="SECCIÓN / PASILLO"
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => onSaveChild(node.id)} disabled={saving || !childForm.name.trim()}
                  className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-lg disabled:opacity-50 transition-colors">
                  {saving ? 'Guardando...' : '✓ Crear'}
                </button>
                <button onClick={() => onChildFormChange(EMPTY_EDIT)}
                  className="px-4 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 text-sm rounded-lg transition-colors">
                  🗑 Limpiar
                </button>
                <button onClick={onCancelAddChild}
                  className="px-4 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 text-sm rounded-lg transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function NodeBody() {
    if (isEditing) {
      return (
        <div className={`mb-2 bg-white dark:bg-surface-800 border ${isRoot ? 'border-brand-300 dark:border-brand-700/50' : 'border-surface-200 dark:border-surface-600 border-dashed'} rounded-xl p-4 space-y-3 shadow-soft`}>
          <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">✏ EDITANDO "{node.name}"</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-500 mb-1">Nombre *</label>
              <input autoFocus value={editForm.name}
                onChange={(e) => onEditChange({ ...editForm, name: up(e.target.value) })}
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" />
            </div>
            <div>
              <label className="block text-xs text-surface-500 mb-1">Código</label>
              <input value={editForm.code}
                onChange={(e) => onEditChange({ ...editForm, code: up(e.target.value) })}
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-500 mb-1">Dirección</label>
              <input value={editForm.address}
                onChange={(e) => onEditChange({ ...editForm, address: up(e.target.value) })}
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" />
            </div>
            <div>
              <label className="block text-xs text-surface-500 mb-1">Bodega padre</label>
              <select value={editForm.parentWarehouseId}
                onChange={(e) => onEditChange({ ...editForm, parentWarehouseId: e.target.value })}
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">(Sin padre — bodega raíz)</option>
                {flatNodes.filter((fn) => fn.id !== node.id).map((fn) => (
                  <option key={fn.id} value={fn.id}>
                    {'  '.repeat(fn.depth)}{fn.depth > 0 ? '↳ ' : ''}{fn.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onSaveEdit(node.id)} disabled={saving || !editForm.name.trim()}
              className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-lg disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : '✓ Guardar'}
            </button>
            <button onClick={() => onEditChange({ name: node.name, code: node.code || '', address: node.address || '', parentWarehouseId: node.parentWarehouseId || '' })}
              className="px-4 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 text-sm rounded-lg transition-colors">
              🗑 Limpiar
            </button>
            <button onClick={onCancelEdit}
              className="px-4 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 text-sm rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={`group mb-2 flex items-center justify-between px-4 py-3 rounded-xl border transition-colors
        ${isRoot
          ? 'bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 shadow-soft'
          : 'bg-surface-50 dark:bg-surface-800/60 border-surface-200 dark:border-surface-700 border-dashed hover:border-surface-300 dark:hover:border-surface-600'}
        ${!node.isActive ? 'opacity-50' : ''}
      `}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg flex-shrink-0">{isRoot ? '🏭' : '📦'}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-surface-800 dark:text-white text-sm truncate">{node.name}</span>
              {node.code && (
                <span className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-500 px-2 py-0.5 rounded-full font-mono flex-shrink-0">
                  {node.code}
                </span>
              )}
              {node.isDefault && (
                <span className="text-xs bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 px-2 py-0.5 rounded-full flex-shrink-0">
                  ★ Principal
                </span>
              )}
              {!node.isActive && (
                <span className="text-xs bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full flex-shrink-0">
                  Inactiva
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {node.address && (
                <span className="text-xs text-surface-500 truncate">{node.address}</span>
              )}
              <span className={`text-xs flex-shrink-0 ${skuCount > 0 ? 'text-surface-500' : 'text-surface-300 dark:text-surface-600'}`}>
                {skuCount > 0 ? `${skuCount} SKU${skuCount !== 1 ? 's' : ''} · ${totalStock.toFixed(0)} uds` : 'Sin stock'}
              </span>
              {(node.children?.length ?? 0) > 0 && (
                <span className="text-xs text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                  {node.children.length} sub-bodega{node.children.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions (visible on hover) */}
        <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onStartAddChild(node.id)} title="Agregar sub-bodega"
            className="text-xs px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/40 hover:bg-indigo-200 dark:hover:bg-indigo-800/60 text-indigo-700 dark:text-indigo-400 rounded-lg transition-colors">
            + Sub
          </button>
          {isRoot && !node.isDefault && node.isActive && (
            <button onClick={() => onSetDefault(node.id)} title="Marcar como bodega principal"
              className="text-xs px-2.5 py-1 bg-surface-100 dark:bg-surface-700 hover:bg-brand-100 dark:hover:bg-surface-600 text-surface-500 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg transition-colors">
              ★
            </button>
          )}
          <button onClick={() => onStartEdit(node)}
            className="text-xs px-2.5 py-1 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 rounded-lg transition-colors">
            ✏
          </button>
          {!node.isDefault && (
            <button onClick={() => onToggle(node)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                node.isActive
                  ? 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400'
                  : 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400'
              }`}>
              {node.isActive ? '⊘' : '☑'}
            </button>
          )}
        </div>
      </div>
    );
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

const EMPTY_CREATE: EditForm = { name: '', code: '', address: '', parentWarehouseId: '' };

export default function WarehousesPage() {
  const toast = useToast();
  const confirmAction = useConfirm();
  const [tree, setTree] = useState<WarehouseNode[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<EditForm>(EMPTY_CREATE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [addChildFor, setAddChildFor] = useState<string | null>(null);
  const [childForm, setChildForm] = useState<EditForm>(EMPTY_CREATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => inventoryApi.getWarehouseTree().then((r) => setTree(r.data));
  useEffect(() => { load(); }, []);

  const flatNodes = useMemo(() => flattenTree(tree), [tree]);
  const totalCount = useMemo(() => countAll(tree), [tree]);

  // ── Create root warehouse ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setError('');
    setSaving(true);
    try {
      await inventoryApi.createWarehouse({
        name: createForm.name.trim(),
        code: createForm.code || undefined,
        address: createForm.address || undefined,
        parentWarehouseId: createForm.parentWarehouseId || undefined,
      });
      setCreateForm(EMPTY_CREATE);
      setShowCreate(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear bodega');
    } finally {
      setSaving(false);
    }
  };

  // ── Save edit ──
  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    try {
      await inventoryApi.updateWarehouse(id, {
        name: editForm.name.trim(),
        code: editForm.code || undefined,
        address: editForm.address || undefined,
        parentWarehouseId: editForm.parentWarehouseId || null,
      });
      setEditingId(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  // ── Save child ──
  const handleSaveChild = async (parentId: string) => {
    if (!childForm.name.trim()) return;
    setSaving(true);
    try {
      await inventoryApi.createWarehouse({
        name: childForm.name.trim(),
        code: childForm.code || undefined,
        address: childForm.address || undefined,
        parentWarehouseId: parentId,
      });
      setAddChildFor(null);
      setChildForm(EMPTY_CREATE);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al crear sub-bodega');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (node: WarehouseNode) => {
    setAddChildFor(null);
    setEditingId(node.id);
    setEditForm({
      name: node.name,
      code: node.code || '',
      address: node.address || '',
      parentWarehouseId: node.parentWarehouseId || '',
    });
  };

  const handleToggle = async (node: WarehouseNode) => {
    const ok = await confirmAction({
      title: node.isActive ? 'Desactivar bodega' : 'Activar bodega',
      message: `¿${node.isActive ? 'Desactivar' : 'Activar'} la bodega "${node.name}"?`,
      variant: node.isActive ? 'danger' : 'default',
    });
    if (!ok) return;
    try {
      await inventoryApi.toggleWarehouse(node.id);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await inventoryApi.updateWarehouse(id, { isDefault: true });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleStartAddChild = (parentId: string) => {
    setEditingId(null);
    setAddChildFor(parentId);
    setChildForm(EMPTY_CREATE);
  };

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🏭</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Bodegas</h1>
            <p className="text-sm text-surface-500">{tree.length} {tree.length === 1 ? 'raíz' : 'raíces'} · {totalCount} total</p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreate((v) => !v); setEditingId(null); setAddChildFor(null); }}
          className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors"
        >
          {showCreate ? '✕ Cancelar' : '+ Nueva Bodega'}
        </button>
      </div>

      <div className="space-y-4">
        {/* Create form */}
        {showCreate && (
          <form onSubmit={handleCreate} className="bg-white dark:bg-surface-800 border border-brand-200 dark:border-brand-700/40 rounded-xl p-5 space-y-4 shadow-soft">
            <h2 className="text-sm font-semibold text-brand-600 dark:text-brand-400">Nueva Bodega</h2>
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 px-4 py-2.5 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-surface-500 mb-1">Nombre *</label>
                <input required autoFocus value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: up(e.target.value) })}
                  placeholder="BODEGA PRINCIPAL"
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Código</label>
                <input value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: up(e.target.value) })}
                  placeholder="BOD-01"
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-surface-500 mb-1">Dirección</label>
                <input value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: up(e.target.value) })}
                  placeholder="AV. PRINCIPAL 123"
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" />
              </div>
              <div>
                <label className="block text-xs text-surface-500 mb-1">Bodega padre (opcional)</label>
                <select value={createForm.parentWarehouseId}
                  onChange={(e) => setCreateForm({ ...createForm, parentWarehouseId: e.target.value })}
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">(Sin padre — bodega raíz)</option>
                  {flatNodes.map((fn) => (
                    <option key={fn.id} value={fn.id}>
                      {'  '.repeat(fn.depth)}{fn.depth > 0 ? '↳ ' : ''}{fn.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving || !createForm.name.trim()}
                className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
                {saving ? 'Guardando...' : '+ Crear Bodega'}
              </button>
              <button type="button" onClick={() => setCreateForm(EMPTY_CREATE)}
                className="px-5 py-2 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 text-sm rounded-lg transition-colors">
                🗑 Limpiar
              </button>
              <button type="button" onClick={() => { setShowCreate(false); setCreateForm(EMPTY_CREATE); }}
                className="px-5 py-2 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 text-sm rounded-lg transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Tree */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4 shadow-soft">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300">Estructura de Bodegas</h2>
            <span className="text-xs text-surface-400">Las acciones aparecen al pasar el cursor</span>
          </div>

          {tree.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🏭</div>
              <p className="text-surface-500 font-medium">No hay bodegas registradas</p>
              <p className="text-surface-400 text-sm mt-1">Crea la primera bodega con el botón de arriba</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tree.map((rootNode) => (
                <WarehouseTreeNode
                  key={rootNode.id}
                  node={rootNode}
                  depth={0}
                  flatNodes={flatNodes}
                  editingId={editingId}
                  editForm={editForm}
                  addChildFor={addChildFor}
                  childForm={childForm}
                  saving={saving}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onEditChange={setEditForm}
                  onSaveEdit={handleSaveEdit}
                  onToggle={handleToggle}
                  onSetDefault={handleSetDefault}
                  onStartAddChild={handleStartAddChild}
                  onCancelAddChild={() => setAddChildFor(null)}
                  onChildFormChange={setChildForm}
                  onSaveChild={handleSaveChild}
                />
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 px-1 text-xs text-surface-400">
          <span>🏭 Bodega raíz</span>
          <span>📦 Sub-bodega</span>
          <span>★ Bodega principal (por defecto)</span>
          <span>⊘ Desactivar · ☑ Activar</span>
        </div>

        {/* Layout: ubicaciones físicas (zona / percha / piso) */}
        <StorageLocationsPanel warehouses={flatNodes} />
      </div>
    </div>
  );
}

// ─── Panel de ubicaciones físicas (zona/percha/piso) ──────────────────────────
function StorageLocationsPanel({ warehouses }: { warehouses: FlatNode[] }) {
  const confirmAction = useConfirm();
  const [locations, setLocations] = useState<any[]>([]);
  const [form, setForm] = useState({ warehouseId: '', zone: '', rack: '', level: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = () => inventoryApi.getLocations().then((r) => setLocations(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!form.warehouseId && warehouses.length > 0) setForm((f) => ({ ...f, warehouseId: warehouses[0].id }));
  }, [warehouses]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.warehouseId) { setErr('Selecciona una bodega'); return; }
    if (!form.zone && !form.rack && !form.level) { setErr('Indica al menos zona, percha o piso'); return; }
    setErr('');
    setSaving(true);
    try {
      await inventoryApi.createLocation({
        warehouseId: form.warehouseId,
        zone: form.zone || undefined,
        rack: form.rack || undefined,
        level: form.level || undefined,
        description: form.description || undefined,
      });
      setForm((f) => ({ ...f, zone: '', rack: '', level: '', description: '' }));
      load();
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Error al crear ubicación');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({ title: 'Eliminar ubicación', message: '¿Eliminar esta ubicación?', variant: 'danger' });
    if (!ok) return;
    try { await inventoryApi.deleteLocation(id); load(); } catch { /* noop */ }
  };

  const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-5 shadow-soft space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300">📍 Ubicaciones físicas (layout)</h2>
        <p className="text-xs text-surface-500">Define rutas de almacenaje dentro de cada bodega: zona, percha y piso. Se usan al recibir mercadería en compras.</p>
      </div>

      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs text-surface-500 mb-1">Bodega *</label>
          <select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className={inputCls}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{'  '.repeat(w.depth)}{w.depth > 0 ? '↳ ' : ''}{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Zona</label>
          <input value={form.zone} onChange={(e) => setForm({ ...form, zone: up(e.target.value) })} placeholder="A" className={`${inputCls} uppercase`} />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Percha</label>
          <input value={form.rack} onChange={(e) => setForm({ ...form, rack: up(e.target.value) })} placeholder="B" className={`${inputCls} uppercase`} />
        </div>
        <div>
          <label className="block text-xs text-surface-500 mb-1">Piso</label>
          <input value={form.level} onChange={(e) => setForm({ ...form, level: up(e.target.value) })} placeholder="5" className={`${inputCls} uppercase`} />
        </div>
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors">
          {saving ? '...' : '+ Crear'}
        </button>
      </form>
      {err && <p className="text-xs text-red-500">{err}</p>}

      {locations.length === 0 ? (
        <p className="text-sm text-surface-400 text-center py-4">No hay ubicaciones registradas.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {locations.map((l) => (
            <div key={l.id} className="group flex items-center gap-2 bg-surface-50 dark:bg-surface-900/50 border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-1.5">
              <span className="text-xs font-mono text-surface-700 dark:text-surface-200">{l.code}</span>
              <span className="text-xs text-surface-400">{l.warehouse?.name}</span>
              <button onClick={() => handleDelete(l.id)} className="text-red-400 hover:text-red-600 text-sm opacity-0 group-hover:opacity-100 transition-opacity">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
