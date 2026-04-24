'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { adminApi } from '@/lib/admin-api';
import { uploadImage } from '@/lib/storage';
import type { Menu } from '@/lib/database.types';
import { useConfirm } from '@/components/ConfirmProvider';
import { useStore } from '../../StoreProvider';
import { formatPrice } from '@/lib/formatters';

/* ── Constants ──────────────────────────────────── */
const CATEGORIES = ['전체', '안주', '주류', '음료', '기타'] as const;

const THUMB_COLORS: Record<string, string> = {
  food1: '#FBE5C8',
  food2: '#E8D4B4',
  food3: '#D4E8D0',
  food4: '#F5C5B8',
  food5: '#FCE1B0',
  food6: '#D0DCEA',
  drink: '#E2EAF4',
};
const THUMB_KEYS = Object.keys(THUMB_COLORS);
const thumbColor = (i: number) => THUMB_COLORS[THUMB_KEYS[i % THUMB_KEYS.length]];

const EMPTY_FORM: MenuForm = {
  name: '',
  category: '안주',
  price: 0,
  stock: 50,
  max_stock: 100,
  description: '',
  options: '',
  tag: '',
  image_url: '',
};

/* ── Types ──────────────────────────────────────── */
interface MenuForm {
  name: string;
  category: string;
  price: number;
  stock: number;
  max_stock: number;
  description: string;
  options: string;
  tag: string;
  image_url: string;
}

/* ── Helpers ────────────────────────────────────── */
function stockStatus(stock: number, max: number) {
  if (max === 0) return { ratio: 0, color: 'var(--crim)', label: '없음' };
  const ratio = stock / max;
  if (ratio <= 0) return { ratio: 0, color: 'var(--crim)', label: '품절' };
  if (ratio <= 0.2) return { ratio, color: 'var(--amber)', label: '부족' };
  return { ratio, color: 'var(--mint)', label: '충분' };
}

/* ── Component ──────────────────────────────────── */
export default function MenuManagementPage() {
  const store = useStore();
  const { confirm: showConfirm } = useConfirm();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MenuForm>({ ...EMPTY_FORM });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEdits, setCatEdits] = useState<{ original: string; name: string; isNew: boolean }[]>([]);
  const [catSaving, setCatSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [myRole, setMyRole] = useState<'owner' | 'manager' | 'kitchen' | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Data fetching ────────────────────────────── */
  const fetchMenus = useCallback(async () => {
    const { data } = await supabase
      .from('menus')
      .select('*')
      .eq('store_id', store.id)
      .order('sort_order', { ascending: true });
    if (data) setMenus(data);
    setLoading(false);
  }, [store.id]);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('store_members')
        .select('role')
        .eq('store_id', store.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setMyRole((data as { role: 'owner' | 'manager' | 'kitchen' } | null)?.role ?? null);
    })();
  }, [store.id]);

  const canEdit = myRole === 'owner' || myRole === 'manager';

  /* ── Grid columns ────────────────────────────── */
  const gridCols = canEdit
    ? '28px 64px 1fr 80px 100px 108px 130px 76px'
    : '28px 64px 1fr 80px 100px 108px 130px';

  /* ── Derived ──────────────────────────────────── */
  const filtered = activeCategory === '전체'
    ? menus
    : menus.filter((m) => m.category === activeCategory);

  const soldOutCount = menus.filter((m) => m.is_sold_out).length;

  const catCounts = CATEGORIES.reduce<Record<string, number>>((acc, c) => {
    acc[c] = c === '전체' ? menus.length : menus.filter((m) => m.category === c).length;
    return acc;
  }, {});

  /* ── CRUD ─────────────────────────────────────── */
  const toggleSoldOut = async (menu: Menu) => {
    const next = !menu.is_sold_out;
    setMenus((prev) => prev.map((m) => (m.id === menu.id ? { ...m, is_sold_out: next } : m)));
    const { error } = await adminApi(`/api/admin/${store.slug}/menu/toggle-soldout`, {
      method: 'POST',
      body: { id: menu.id, is_sold_out: next },
    });
    if (error) {
      // 롤백
      setMenus((prev) => prev.map((m) => (m.id === menu.id ? { ...m, is_sold_out: !next } : m)));
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (menu: Menu) => {
    setEditingId(menu.id);
    setForm({
      name: menu.name,
      category: menu.category,
      price: menu.price,
      stock: menu.stock,
      max_stock: menu.max_stock,
      description: menu.description ?? '',
      options: menu.options ?? '',
      tag: menu.tag ?? '',
      image_url: menu.image_url ?? '',
    });
    setModalOpen(true);
  };

  const saveMenu = async () => {
    const payload = {
      name: form.name,
      category: form.category,
      price: form.price,
      stock: form.stock,
      max_stock: form.max_stock,
      description: form.description || null,
      options: form.options || null,
      tag: form.tag || null,
      image_url: form.image_url || null,
      is_sold_out: form.stock <= 0,
      sort_order: editingId ? undefined : menus.length,
    };

    if (editingId) {
      await adminApi(`/api/admin/${store.slug}/menu`, {
        method: 'PATCH',
        body: { id: editingId, ...payload },
      });
    } else {
      await adminApi(`/api/admin/${store.slug}/menu`, {
        method: 'POST',
        body: payload,
      });
    }

    setModalOpen(false);
    fetchMenus();
  };

  const deleteMenu = async (id: number) => {
    const ok = await showConfirm({ title: '메뉴 삭제', message: '정말 삭제하시겠습니까?', danger: true, confirmText: '삭제' });
    if (!ok) return;
    const { error } = await adminApi(`/api/admin/${store.slug}/menu`, {
      method: 'DELETE',
      body: { id },
    });
    if (!error) {
      setMenus((prev) => prev.filter((m) => m.id !== id));
    }
  };

  /* ── Drag & Drop ──────────────────────────────── */
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = async (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const reordered = [...filtered];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);

    // Optimistic update
    const ids = reordered.map((m) => m.id);
    setMenus((prev) => {
      const updated = [...prev];
      ids.forEach((id, i) => {
        const found = updated.find((m) => m.id === id);
        if (found) found.sort_order = i;
      });
      return updated.sort((a, b) => a.sort_order - b.sort_order);
    });

    // Persist
    await adminApi(`/api/admin/${store.slug}/menu/reorder`, {
      method: 'POST',
      body: { ids },
    });

    setDragIdx(null);
    setDragOverIdx(null);
  };

  /* ── Image upload ──────────────────────────────── */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await uploadImage('menu-images', file, 'menus');
    if (result.error) {
      console.error('Menu image upload failed:', result.error);
    } else if (result.url) {
      setForm((prev) => ({ ...prev, image_url: result.url! }));
    }
    setUploading(false);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  /* ── Category editing ─────────────────────────── */
  const openCatModal = () => {
    const uniqueCats = Array.from(new Set(menus.map((m) => m.category)));
    setCatEdits(uniqueCats.map((c) => ({ original: c, name: c, isNew: false })));
    setCatModalOpen(true);
  };

  const updateCatName = (idx: number, name: string) => {
    setCatEdits((prev) => prev.map((c, i) => (i === idx ? { ...c, name } : c)));
  };

  const addCategory = () => {
    setCatEdits((prev) => [...prev, { original: '', name: '', isNew: true }]);
  };

  const deleteCategory = async (idx: number) => {
    const cat = catEdits[idx];
    if (!cat.isNew) {
      const count = menus.filter((m) => m.category === cat.original).length;
      if (count > 0) {
        const ok = await showConfirm({
          title: '카테고리 삭제',
          message: `"${cat.original}" 카테고리에 ${count}개의 메뉴가 있습니다. 삭제하면 해당 메뉴의 카테고리가 "기타"로 변경됩니다. 계속하시겠습니까?`,
          danger: true,
          confirmText: '삭제',
        });
        if (!ok) return;
      }
    }
    setCatEdits((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveCatEdits = async () => {
    setCatSaving(true);
    try {
      // Find deleted categories (were in original but not in current edits)
      const originalCats = Array.from(new Set(menus.map((m) => m.category)));
      const keptOriginals = catEdits.filter((c) => !c.isNew).map((c) => c.original);
      const deletedCats = originalCats.filter((c) => !keptOriginals.includes(c));

      // Move deleted category menus to "기타" — fetch ids then PATCH each
      for (const cat of deletedCats) {
        const affected = menus.filter((m) => m.category === cat);
        for (const m of affected) {
          await adminApi(`/api/admin/${store.slug}/menu`, {
            method: 'PATCH',
            body: { id: m.id, category: '기타' },
          });
        }
      }

      // Rename changed categories
      for (const cat of catEdits) {
        if (!cat.isNew && cat.name && cat.name !== cat.original) {
          const affected = menus.filter((m) => m.category === cat.original);
          for (const m of affected) {
            await adminApi(`/api/admin/${store.slug}/menu`, {
              method: 'PATCH',
              body: { id: m.id, category: cat.name },
            });
          }
        }
      }

      setCatModalOpen(false);
      fetchMenus();
    } catch (err) {
      console.error('Category save error:', err);
    } finally {
      setCatSaving(false);
    }
  };

  /* ── Render ───────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
        불러오는 중...
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* ── Header ──────────────────────────────── */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>메뉴 관리</h1>
          <p style={S.subtitle}>
            {menus.length}개 메뉴 · 품절 {soldOutCount}개
          </p>
        </div>
        {canEdit && (
          <button style={S.addBtn} onClick={openAdd}>
            ＋ 메뉴 추가
          </button>
        )}
      </div>

      {/* ── Category Filter ────────────────────── */}
      <div style={S.filterBar}>
        <div style={S.pills}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                ...S.pill,
                ...(activeCategory === cat ? S.pillActive : {}),
              }}
            >
              {cat}
              <span style={S.pillCount}>{catCounts[cat]}</span>
            </button>
          ))}
        </div>
        {canEdit && (
          <button style={S.catEditBtn} onClick={openCatModal}>⚙ 카테고리 편집</button>
        )}
      </div>

      {/* ── Table Header ───────────────────────── */}
      <div style={{ ...S.tableHead, gridTemplateColumns: gridCols }}>
        <span />
        <span />
        <span>메뉴명</span>
        <span>카테고리</span>
        <span>가격</span>
        <span>재고</span>
        <span>품절</span>
        {canEdit && <span>작업</span>}
      </div>

      {/* ── Menu Rows ──────────────────────────── */}
      <div ref={listRef}>
        {filtered.map((menu, idx) => {
          const ss = stockStatus(menu.stock, menu.max_stock);
          const isSoldOut = menu.is_sold_out;
          return (
            <div
              key={menu.id}
              draggable={canEdit}
              onDragStart={canEdit ? () => handleDragStart(idx) : undefined}
              onDragOver={canEdit ? (e) => handleDragOver(e, idx) : undefined}
              onDrop={canEdit ? () => handleDrop(idx) : undefined}
              onDragEnd={canEdit ? () => { setDragIdx(null); setDragOverIdx(null); } : undefined}
              style={{
                ...S.row,
                gridTemplateColumns: gridCols,
                opacity: isSoldOut ? 0.55 : 1,
                background:
                  dragOverIdx === idx
                    ? 'var(--ink-050)'
                    : idx % 2 === 0
                    ? 'var(--white)'
                    : 'var(--surface-2)',
              }}
            >
              {/* Drag handle */}
              <span style={S.dragHandle}>⠿</span>

              {/* Thumbnail */}
              <div
                style={{
                  ...S.thumb,
                  background: menu.image_url ? `url(${menu.image_url}) center/cover no-repeat` : thumbColor(idx),
                }}
              >
                {!menu.image_url && menu.name.charAt(0)}
              </div>

              {/* Name + tag + desc */}
              <div style={S.nameCell}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={S.menuName}>{menu.name}</span>
                  {menu.tag && <span style={S.tagBadge}>{menu.tag}</span>}
                </div>
                {menu.description && (
                  <div style={S.menuDesc}>{menu.description}</div>
                )}
              </div>

              {/* Category */}
              <span style={S.cellText}>{menu.category}</span>

              {/* Price */}
              <span style={{ ...S.cellText, fontVariantNumeric: 'tabular-nums' }}>
                {formatPrice(menu.price)}
              </span>

              {/* Stock */}
              <div style={S.stockCell}>
                <div style={S.stockNumbers}>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 13 }}>
                    {menu.stock}
                  </span>
                  <span style={{ color: 'var(--text-3)', fontSize: 12 }}>/{menu.max_stock}</span>
                </div>
                <div style={S.stockBarTrack}>
                  <div
                    style={{
                      ...S.stockBarFill,
                      width: `${Math.min(ss.ratio * 100, 100)}%`,
                      background: ss.color,
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, color: ss.color, fontWeight: 600 }}>
                  {ss.label}
                </span>
              </div>

              {/* Sold-out toggle */}
              <div style={S.toggleWrap}>
                <button
                  onClick={() => toggleSoldOut(menu)}
                  style={{
                    ...S.switchTrack,
                    background: isSoldOut ? 'var(--ink-200)' : 'var(--mint)',
                  }}
                >
                  <div
                    style={{
                      ...S.switchThumb,
                      transform: isSoldOut ? 'translateX(0)' : 'translateX(22px)',
                    }}
                  />
                </button>
              </div>

              {/* Actions */}
              {canEdit && (
                <div style={S.actions}>
                  <button style={S.iconBtn} onClick={() => openEdit(menu)} title="수정">
                    ✎
                  </button>
                  <button
                    style={{ ...S.iconBtn, color: 'var(--crim)' }}
                    onClick={() => deleteMenu(menu.id)}
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            등록된 메뉴가 없습니다
          </div>
        )}
      </div>

      {/* ── Modal ──────────────────────────────── */}
      {modalOpen && (
        <div style={S.overlay} onClick={() => setModalOpen(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={S.modalTitle}>
              {editingId ? '메뉴 수정' : '메뉴 추가'}
            </h2>

            {/* Photo upload area */}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            <div style={S.photoArea} onClick={() => fileInputRef.current?.click()}>
              {uploading ? (
                <div style={S.photoPlaceholder}>
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>업로드 중...</span>
                </div>
              ) : form.image_url ? (
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <img src={form.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--r-md)' }} />
                  <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>
                    변경
                  </div>
                </div>
              ) : (
                <div style={S.photoPlaceholder}>
                  <span style={{ fontSize: 28, lineHeight: 1 }}>📷</span>
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>사진 추가</span>
                </div>
              )}
            </div>

            {/* Name */}
            <label style={S.label}>메뉴명</label>
            <input
              style={S.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="메뉴 이름을 입력하세요"
            />

            {/* Category */}
            <label style={S.label}>카테고리</label>
            <select
              style={S.input}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {(() => {
                const allCats = Array.from(new Set([
                  ...CATEGORIES.filter((c) => c !== '전체'),
                  ...menus.map((m) => m.category),
                ]));
                return allCats.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ));
              })()}
            </select>

            {/* Price */}
            <label style={S.label}>가격 (원)</label>
            <input
              style={S.input}
              type="number"
              value={form.price || ''}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              placeholder="0"
            />

            {/* Stock stepper */}
            <label style={S.label}>재고</label>
            <div style={S.stockStepper}>
              <button style={S.stepBtn} onClick={() => setForm({ ...form, stock: Math.max(0, form.stock - 10) })}>-10</button>
              <button style={S.stepBtn} onClick={() => setForm({ ...form, stock: Math.max(0, form.stock - 1) })}>-1</button>
              <span style={S.stockValue}>{form.stock}</span>
              <button style={S.stepBtn} onClick={() => setForm({ ...form, stock: form.stock + 1 })}>+1</button>
              <button style={S.stepBtn} onClick={() => setForm({ ...form, stock: form.stock + 10 })}>+10</button>
            </div>
            <div style={S.presetChips}>
              {[20, 30, 50, 100].map((n) => (
                <button
                  key={n}
                  style={{
                    ...S.chip,
                    ...(form.stock === n ? S.chipActive : {}),
                  }}
                  onClick={() => setForm({ ...form, stock: n, max_stock: n })}
                >
                  {n}
                </button>
              ))}
              <button
                style={{
                  ...S.chip,
                  ...(form.stock === 9999 ? S.chipActive : {}),
                }}
                onClick={() => setForm({ ...form, stock: 9999, max_stock: 9999 })}
              >
                무제한
              </button>
            </div>

            {/* Tag */}
            <label style={S.label}>태그 (선택)</label>
            <input
              style={S.input}
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
              placeholder="예: 인기, 신메뉴, 추천"
            />

            {/* Description */}
            <label style={S.label}>설명</label>
            <textarea
              style={{ ...S.input, minHeight: 72, resize: 'vertical' }}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="메뉴 설명을 입력하세요"
            />

            {/* Options */}
            <label style={S.label}>옵션 (콤마로 구분)</label>
            <input
              style={S.input}
              value={form.options}
              onChange={(e) => setForm({ ...form, options: e.target.value })}
              placeholder="예: 순한맛, 매운맛"
            />

            {/* Buttons */}
            <div style={S.modalActions}>
              <button
                style={{ ...S.modalBtn, background: 'var(--ink-100)', color: 'var(--text)' }}
                onClick={() => setModalOpen(false)}
              >
                취소
              </button>
              <button
                style={{ ...S.modalBtn, background: 'var(--neon)', color: 'var(--neon-ink)' }}
                onClick={saveMenu}
              >
                {editingId ? '저장' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Edit Modal ───────────────── */}
      {catModalOpen && (
        <div style={S.overlay} onClick={() => setCatModalOpen(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={S.modalTitle}>카테고리 편집</h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px' }}>
              카테고리 이름을 수정하면 해당 카테고리의 모든 메뉴가 함께 변경됩니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {catEdits.map((cat, idx) => {
                const menuCount = cat.isNew ? 0 : menus.filter((m) => m.category === cat.original).length;
                return (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--ink-050)',
                    border: '1px solid var(--ink-100)',
                  }}>
                    <input
                      style={{
                        ...S.input,
                        height: 36,
                        flex: 1,
                        background: 'var(--white)',
                      }}
                      value={cat.name}
                      onChange={(e) => updateCatName(idx, e.target.value)}
                      placeholder="카테고리 이름"
                    />
                    {!cat.isNew && (
                      <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, minWidth: 40, textAlign: 'center' }}>
                        {menuCount}개
                      </span>
                    )}
                    {cat.isNew && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--mint)',
                        background: 'color-mix(in oklab, var(--mint) 12%, white)',
                        padding: '2px 8px',
                        borderRadius: 'var(--r-pill)',
                        flexShrink: 0,
                      }}>
                        새 카테고리
                      </span>
                    )}
                    <button
                      onClick={() => deleteCategory(idx)}
                      style={{
                        ...S.iconBtn,
                        color: 'var(--crim)',
                        width: 28,
                        height: 28,
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                      title="삭제"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={addCategory}
              style={{
                ...S.catEditBtn,
                marginTop: 12,
                width: '100%',
                justifyContent: 'center',
                height: 38,
                fontSize: 13,
                border: '2px dashed var(--ink-200)',
              }}
            >
              + 추가
            </button>

            <div style={S.modalActions}>
              <button
                style={{ ...S.modalBtn, background: 'var(--ink-100)', color: 'var(--text)' }}
                onClick={() => setCatModalOpen(false)}
              >
                취소
              </button>
              <button
                style={{ ...S.modalBtn, background: 'var(--neon)', color: 'var(--neon-ink)', opacity: catSaving ? 0.6 : 1 }}
                onClick={saveCatEdits}
                disabled={catSaving}
              >
                {catSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Styles ─────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  page: {
    padding: '28px 32px 48px',
    maxWidth: 1060,
  },

  /* Header */
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
    lineHeight: 1.3,
    color: 'var(--ink-900)',
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-3)',
    margin: '4px 0 0',
    fontWeight: 500,
  },
  addBtn: {
    appearance: 'none' as const,
    border: 0,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    fontWeight: 700,
    fontSize: 14,
    height: 42,
    padding: '0 20px',
    borderRadius: 'var(--r-md)',
    background: 'var(--neon)',
    color: 'var(--neon-ink)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: 'inset 0 -3px 0 rgba(58,42,0,.18)',
  },

  /* Category filter */
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  pills: {
    display: 'flex',
    gap: 6,
  },
  pill: {
    appearance: 'none' as const,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    fontWeight: 600,
    fontSize: 13,
    height: 36,
    padding: '0 14px',
    borderRadius: 'var(--r-pill)',
    background: 'var(--white)',
    color: 'var(--text-2)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all .15s ease',
  },
  pillActive: {
    background: 'var(--ink-900)',
    color: '#fff',
    border: '1px solid var(--ink-900)',
  },
  pillCount: {
    fontSize: 11,
    fontWeight: 700,
    opacity: 0.65,
  },
  catEditBtn: {
    appearance: 'none' as const,
    background: 'transparent',
    border: '1.5px dashed var(--ink-300)',
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    fontWeight: 600,
    fontSize: 12,
    color: 'var(--text-3)',
    height: 34,
    padding: '0 14px',
    borderRadius: 'var(--r-pill)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
  },

  /* Table header */
  tableHead: {
    display: 'grid',
    alignItems: 'center',
    padding: '0 16px',
    height: 38,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-3)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border)',
  },

  /* Rows */
  row: {
    display: 'grid',
    alignItems: 'center',
    padding: '10px 16px',
    borderBottom: '1px solid var(--ink-100)',
    transition: 'opacity .15s ease, background .12s ease',
    minHeight: 60,
  },
  dragHandle: {
    cursor: 'grab',
    color: 'var(--ink-300)',
    fontSize: 16,
    userSelect: 'none' as const,
    textAlign: 'center' as const,
  },

  /* Thumbnail */
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 'var(--r-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 16,
    color: 'var(--ink-600)',
  },

  /* Name cell */
  nameCell: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    paddingRight: 12,
    minWidth: 0,
  },
  menuName: {
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--ink-900)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tagBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 7px',
    borderRadius: 'var(--r-pill)',
    fontSize: 10,
    fontWeight: 700,
    background: 'var(--neon)',
    color: 'var(--neon-ink)',
    lineHeight: 1.6,
    flexShrink: 0,
  },
  menuDesc: {
    fontSize: 12,
    color: 'var(--text-3)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  cellText: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-2)',
  },

  /* Stock */
  stockCell: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
    minWidth: 0,
  },
  stockNumbers: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 1,
  },
  stockBarTrack: {
    width: '100%',
    height: 4,
    borderRadius: 'var(--r-pill)',
    background: 'var(--ink-100)',
    overflow: 'hidden',
  },
  stockBarFill: {
    height: '100%',
    borderRadius: 'var(--r-pill)',
    transition: 'width .25s ease',
  },

  /* Toggle switch */
  toggleWrap: {
    display: 'flex',
    justifyContent: 'center',
  },
  switchTrack: {
    appearance: 'none' as const,
    border: 0,
    cursor: 'pointer',
    width: 52,
    height: 30,
    borderRadius: 'var(--r-pill)',
    position: 'relative' as const,
    transition: 'background .2s ease',
    padding: 0,
    flexShrink: 0,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,.18)',
    position: 'absolute' as const,
    top: 3,
    left: 3,
    transition: 'transform .2s ease',
  },

  /* Actions */
  actions: {
    display: 'flex',
    gap: 4,
    justifyContent: 'center',
  },
  iconBtn: {
    appearance: 'none' as const,
    border: 0,
    cursor: 'pointer',
    background: 'transparent',
    width: 32,
    height: 32,
    borderRadius: 'var(--r-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    color: 'var(--text-3)',
    transition: 'background .12s ease',
  },

  /* Modal */
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(14,18,32,.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    animation: 'fadeIn .15s ease',
  },
  modal: {
    background: 'var(--white)',
    borderRadius: 'var(--r-lg)',
    padding: '28px 32px 24px',
    width: 440,
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    boxShadow: 'var(--shadow-3)',
    animation: 'pop .2s ease',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 800,
    margin: '0 0 20px',
    color: 'var(--ink-900)',
  },

  /* Photo upload */
  photoArea: {
    width: '100%',
    height: 140,
    borderRadius: 'var(--r-md)',
    border: '2px dashed var(--ink-200)',
    marginBottom: 20,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  photoPlaceholder: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 6,
  },

  /* Form */
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-2)',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    width: '100%',
    height: 42,
    padding: '0 14px',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--border)',
    fontSize: 14,
    fontFamily: 'var(--f-sans)',
    color: 'var(--text)',
    outline: 'none',
    background: 'var(--white)',
  },

  /* Stock stepper */
  stockStepper: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  stepBtn: {
    appearance: 'none' as const,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    fontWeight: 700,
    fontSize: 13,
    width: 44,
    height: 36,
    borderRadius: 'var(--r-sm)',
    background: 'var(--white)',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockValue: {
    flex: 1,
    textAlign: 'center' as const,
    fontWeight: 800,
    fontSize: 18,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--ink-900)',
  },

  /* Preset chips */
  presetChips: {
    display: 'flex',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap' as const,
  },
  chip: {
    appearance: 'none' as const,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    fontWeight: 600,
    fontSize: 12,
    height: 30,
    padding: '0 12px',
    borderRadius: 'var(--r-pill)',
    background: 'var(--white)',
    color: 'var(--text-2)',
  },
  chipActive: {
    background: 'var(--ink-900)',
    color: '#fff',
    border: '1px solid var(--ink-900)',
  },

  /* Modal actions */
  modalActions: {
    display: 'flex',
    gap: 10,
    marginTop: 24,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    appearance: 'none' as const,
    border: 0,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    fontWeight: 700,
    fontSize: 14,
    height: 44,
    padding: '0 24px',
    borderRadius: 'var(--r-md)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
