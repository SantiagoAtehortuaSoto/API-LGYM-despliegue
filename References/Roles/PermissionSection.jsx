import React, { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ModuleContent, memoizedModulos } from './modalRoles';

export const PermissionSection = memo(({ 
  collapsedModules, 
  toggleModule, 
  permisos = {}, 
  onPermisoChange,
  disabled = false
}) => (
  <div className="seccion-permisos">
    <h3>Permisos</h3>
    <div className="modulos-lista">
      {memoizedModulos.map(({ categoria, modulos }) => (
        <div key={categoria} className="modulo-item">
          <button
            type="button"
            className="encabezado-modulo"
            onClick={() => toggleModule(categoria)}
          >
            <h3>{categoria}</h3>
            {collapsedModules[categoria] ? (
              <ChevronRight className="icono-flecha" />
            ) : (
              <ChevronDown className="icono-flecha" />
            )}
          </button>
          {!collapsedModules[categoria] && (
            <div className="contenido-modulo">
              <ModuleContent
                categoria={categoria}
                modulos={modulos}
                permisos={permisos}
                onPermisoChange={onPermisoChange}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)
);

PermissionSection.displayName = 'PermissionSection';
