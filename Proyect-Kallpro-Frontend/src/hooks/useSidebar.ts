import { useState, useEffect } from 'react';

export function useSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('kallpa-sidebar');
    return saved === 'collapsed';
  });

  useEffect(() => {
    localStorage.setItem('kallpa-sidebar', collapsed ? 'collapsed' : 'open');
  }, [collapsed]);

  const toggle = () => setCollapsed(c => !c);
  const expand = () => setCollapsed(false);
  const collapse = () => setCollapsed(true);

  return { collapsed, toggle, expand, collapse };
}
