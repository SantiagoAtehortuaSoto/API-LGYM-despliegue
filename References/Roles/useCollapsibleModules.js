import { useCallback, useState } from 'react';

export const useCollapsibleModules = (memoizedModulos = [], initialState = true) => {
  const [collapsedModules, setCollapsedModules] = useState(() => {
    // Crear estado inicial con todos los módulos colapsados
    const initialCollapsedState = {};
    memoizedModulos.forEach(({ categoria }) => {
      initialCollapsedState[categoria] = initialState;
    });
    return initialCollapsedState;
  });

  const toggleModule = useCallback((categoria) => {
    setCollapsedModules(prev => ({
      ...prev,
      [categoria]: !prev[categoria]
    }));
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedModules(() =>
      memoizedModulos.reduce((acc, { categoria }) => ({
        ...acc,
        [categoria]: false
      }), {})
    );
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedModules(() =>
      memoizedModulos.reduce((acc, { categoria }) => ({
        ...acc,
        [categoria]: true
      }), {})
    );
  }, []);

  const toggleAll = useCallback(() => {
    const allCollapsed = Object.values(collapsedModules).every(collapsed => collapsed);
    if (allCollapsed) {
      expandAll();
    } else {
      collapseAll();
    }
  }, [collapsedModules, expandAll, collapseAll]);

  const isAllCollapsed = useCallback(() => {
    return Object.values(collapsedModules).every(collapsed => collapsed);
  }, [collapsedModules]);

  const isAllExpanded = useCallback(() => {
    return Object.values(collapsedModules).every(collapsed => !collapsed);
  }, [collapsedModules]);

  return {
    collapsedModules,
    toggleModule,
    expandAll,
    collapseAll,
    toggleAll,
    isAllCollapsed,
    isAllExpanded
  };
};
