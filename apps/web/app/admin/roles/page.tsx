import { Fragment } from "react";
import { Crown, Shield, ShieldCheck, Feather, BookOpen, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";

interface RoleInfo {
  key: string;
  name: string;
  icon: typeof Crown;
  color: string;
  tagline: string;
  description: string;
}

const ROLES: RoleInfo[] = [
  {
    key: "super_admin",
    name: "Super Admin",
    icon: Crown,
    color: "text-red-400 border-red-500/40 bg-red-500/5",
    tagline: "Acceso total al sistema",
    description: "Fundadores o quien tenga responsabilidad total. Único rol que puede gestionar otros super admins, modificar permisos del sistema y ver/editar configuración crítica.",
  },
  {
    key: "admin",
    name: "Admin",
    icon: Shield,
    color: "text-orange-400 border-orange-500/40 bg-orange-500/5",
    tagline: "Operación día a día",
    description: "Equipo operativo de CharBook. Gestiona libros, autores, categorías, finanzas y todas las funciones de moderación. No puede asignar super_admin ni tocar config del sistema.",
  },
  {
    key: "moderator",
    name: "Moderador",
    icon: ShieldCheck,
    color: "text-amber-400 border-amber-500/40 bg-amber-500/5",
    tagline: "Salud de la comunidad",
    description: "Voluntarios o staff parcial. Revisa reportes, modera salones, aprueba solicitudes de Creador y resuelve conflictos. No puede editar el catálogo ni ver finanzas.",
  },
  {
    key: "creator",
    name: "Creador",
    icon: Feather,
    color: "text-primary border-primary/40 bg-primary/5",
    tagline: "Publica obras originales",
    description: "Autores aprobados tras pasar la rúbrica 8/12. Pueden subir obras propias, abrir salones, recibir propinas y monetizar (10% comisión CharBook). Su trust_score determina si sus capítulos pasan revisión.",
  },
  {
    key: "reader",
    name: "Lector",
    icon: BookOpen,
    color: "text-slate-400 border-border bg-card",
    tagline: "Rol base — todos lo tienen al registrarse",
    description: "Cualquier usuario nuevo. Lee, comenta, califica, crea antologías, sigue lectores y se une a salones. Puede postular a Creador si cumple los prerrequisitos.",
  },
];

type Capability =
  | { label: string; super: true; admin: true; mod: true; creator: true; reader: true }
  | { label: string; super: true; admin: true; mod: boolean; creator: boolean; reader: boolean };

const CAPABILITIES: { group: string; items: Array<{ label: string; super: boolean; admin: boolean; mod: boolean; creator: boolean; reader: boolean }> }[] = [
  {
    group: "Lectura y consumo",
    items: [
      { label: "Leer libros públicos", super: true, admin: true, mod: true, creator: true, reader: true },
      { label: "Marcar favoritos, estantes (want_to_read / leyendo / leído)", super: true, admin: true, mod: true, creator: true, reader: true },
      { label: "Escribir reseñas y calificar", super: true, admin: true, mod: true, creator: true, reader: true },
      { label: "Crear antologías (públicas o privadas)", super: true, admin: true, mod: true, creator: true, reader: true },
    ],
  },
  {
    group: "Comunidad",
    items: [
      { label: "Seguir a otros lectores", super: true, admin: true, mod: true, creator: true, reader: true },
      { label: "Comentar y reaccionar a actividades", super: true, admin: true, mod: true, creator: true, reader: true },
      { label: "Postular como Creador", super: false, admin: false, mod: false, creator: false, reader: true },
      { label: "Crear Salones (comunidades temáticas)", super: true, admin: true, mod: true, creator: true, reader: false },
      { label: "Reportar contenido", super: true, admin: true, mod: true, creator: true, reader: true },
    ],
  },
  {
    group: "Publicación",
    items: [
      { label: "Publicar obras originales (novelas, cuentos, webtoons)", super: true, admin: true, mod: false, creator: true, reader: false },
      { label: "Editar mis propias obras", super: true, admin: true, mod: false, creator: true, reader: false },
      { label: "Recibir propinas (Stripe Connect, 10% CharBook)", super: false, admin: false, mod: false, creator: true, reader: false },
      { label: "Vender obras / suscripciones propias", super: false, admin: false, mod: false, creator: true, reader: false },
    ],
  },
  {
    group: "Moderación",
    items: [
      { label: "Resolver reportes de la comunidad", super: true, admin: true, mod: true, creator: false, reader: false },
      { label: "Revisar solicitudes de Creador (rúbrica)", super: true, admin: true, mod: true, creator: false, reader: false },
      { label: "Suspender usuarios temporalmente", super: true, admin: true, mod: true, creator: false, reader: false },
      { label: "Banear permanentemente", super: true, admin: true, mod: false, creator: false, reader: false },
      { label: "Ocultar / eliminar contenido", super: true, admin: true, mod: true, creator: false, reader: false },
      { label: "Moderar salones (todos)", super: true, admin: true, mod: true, creator: false, reader: false },
    ],
  },
  {
    group: "Catálogo editorial",
    items: [
      { label: "Crear / editar libros", super: true, admin: true, mod: false, creator: false, reader: false },
      { label: "Crear / editar autores y categorías", super: true, admin: true, mod: false, creator: false, reader: false },
      { label: "Importar metadata de Google Books / Open Library", super: true, admin: true, mod: false, creator: false, reader: false },
      { label: "Gestionar enlaces de afiliados", super: true, admin: true, mod: false, creator: false, reader: false },
    ],
  },
  {
    group: "Sistema y finanzas",
    items: [
      { label: "Asignar / quitar roles (excepto super_admin)", super: true, admin: true, mod: false, creator: false, reader: false },
      { label: "Asignar rol super_admin", super: true, admin: false, mod: false, creator: false, reader: false },
      { label: "Ver estadísticas financieras", super: true, admin: true, mod: false, creator: false, reader: false },
      { label: "Gestionar planes de suscripción", super: true, admin: true, mod: false, creator: false, reader: false },
      { label: "Editar configuración del sistema", super: true, admin: false, mod: false, creator: false, reader: false },
      { label: "Ver logs / auditoría", super: true, admin: false, mod: false, creator: false, reader: false },
    ],
  },
];

export const metadata = { title: "Roles y permisos" };

export default function RolesPage() {
  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Roles y permisos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          La jerarquía de CharBook Atelier y qué puede hacer cada rol.
        </p>
      </div>

      {/* Cards de roles */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((role) => {
          const Icon = role.icon;
          return (
            <Card key={role.key} className={`border p-5 ${role.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-5 w-5" />
                <h3 className="font-serif text-lg font-bold">{role.name}</h3>
              </div>
              <p className="text-xs uppercase tracking-wide opacity-70 mb-2">{role.tagline}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{role.description}</p>
            </Card>
          );
        })}
      </div>

      {/* Matriz de permisos */}
      <div>
        <h2 className="font-serif text-2xl font-bold tracking-tight mb-4">Matriz detallada</h2>
        <Card className="border-border/60 bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left py-3 px-4 font-medium">Permiso</th>
                <th className="py-3 px-3 font-medium text-red-400">Super</th>
                <th className="py-3 px-3 font-medium text-orange-400">Admin</th>
                <th className="py-3 px-3 font-medium text-amber-400">Mod</th>
                <th className="py-3 px-3 font-medium text-primary">Creador</th>
                <th className="py-3 px-3 font-medium">Lector</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((group) => (
                <Fragment key={group.group}>
                  <tr className="border-t border-border/40 bg-muted/20">
                    <td colSpan={6} className="py-2 px-4 text-[11px] font-bold uppercase tracking-wider text-primary">
                      {group.group}
                    </td>
                  </tr>
                  {group.items.map((item, i) => (
                    <tr key={`${group.group}-${i}`} className="border-t border-border/20 hover:bg-accent/20">
                      <td className="py-2.5 px-4">{item.label}</td>
                      <CapCell yes={item.super} />
                      <CapCell yes={item.admin} />
                      <CapCell yes={item.mod} />
                      <CapCell yes={item.creator} />
                      <CapCell yes={item.reader} />
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Notas */}
      <Card className="border-primary/30 bg-primary/5 p-5 text-sm space-y-2">
        <h3 className="font-serif font-bold">Notas importantes</h3>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs">
          <li>Un usuario puede tener <strong className="text-foreground">múltiples roles</strong> simultáneamente (ej: admin + creator).</li>
          <li>El rol <strong className="text-foreground">lector</strong> es la base de todo usuario nuevo — no se elimina cuando suben de rol.</li>
          <li>Los <strong className="text-foreground">creadores nuevos</strong> empiezan con trust_score=25. Sus capítulos pasan revisión hasta llegar a score 40+.</li>
          <li>Los <strong className="text-foreground">salones</strong> que crea un creador pueden ser moderados por su dueño o por staff global.</li>
          <li>Para asignar/quitar roles, ve a <code className="text-primary">/admin/usuarios</code> y usa el menú "Roles".</li>
        </ul>
      </Card>
    </div>
  );
}

function CapCell({ yes }: { yes: boolean }) {
  return (
    <td className="py-2.5 px-3 text-center">
      {yes ? (
        <Check className="h-4 w-4 text-emerald-500 inline" strokeWidth={2.5} />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/30 inline" />
      )}
    </td>
  );
}
