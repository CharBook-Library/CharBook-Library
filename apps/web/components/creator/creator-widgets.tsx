import Link from "next/link";
import Image from "next/image";
import {
  Megaphone,
  Lightbulb,
  CalendarDays,
  Link as LinkIcon,
  BookPlus,
  Folder,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  CreatorWidget,
  CreatorWidgetGroups,
  CreatorWidgetType,
} from "@/lib/types";

interface CreatorWidgetsProps {
  groups: CreatorWidgetGroups;
}

/**
 * Renderiza las 6 secciones del perfil de creador a partir de los widgets
 * agrupados por tipo. Solo se monta lo que tenga contenido.
 *
 *   📣 announcement  → Anuncios (card destacada arriba)
 *   💡 tip           → Tips de lectura
 *   📅 event         → Eventos próximos (con fecha)
 *   🔗 link          → Acceso directo (link externo)
 *   📚 new_arrival   → Nuevas adquisiciones (recomendaciones de libros)
 *   🗂️ featured_cat → Categorías destacadas
 */
export function CreatorWidgets({ groups }: CreatorWidgetsProps) {
  const order: CreatorWidgetType[] = [
    "announcement",
    "new_arrival",
    "event",
    "tip",
    "featured_cat",
    "link",
  ];

  const visible = order.filter((t) => (groups[t]?.length ?? 0) > 0);
  if (visible.length === 0) return null;

  return (
    <div className="mt-12 space-y-10">
      {visible.map((type) => (
        <WidgetSection key={type} type={type} items={groups[type] ?? []} />
      ))}
    </div>
  );
}

const SECTION_META: Record<
  CreatorWidgetType,
  { label: string; icon: typeof Megaphone; accent: string }
> = {
  announcement: { label: "Anuncios", icon: Megaphone, accent: "text-amber-500" },
  new_arrival: { label: "Nuevas adquisiciones", icon: BookPlus, accent: "text-primary" },
  event: { label: "Eventos", icon: CalendarDays, accent: "text-violet-400" },
  tip: { label: "Tips de lectura", icon: Lightbulb, accent: "text-emerald-400" },
  featured_cat: { label: "Categorías destacadas", icon: Folder, accent: "text-sky-400" },
  link: { label: "Acceso directo", icon: LinkIcon, accent: "text-rose-400" },
};

function WidgetSection({
  type,
  items,
}: {
  type: CreatorWidgetType;
  items: CreatorWidget[];
}) {
  const meta = SECTION_META[type];
  const Icon = meta.icon;

  return (
    <section>
      <div className="mb-5 flex items-center gap-2">
        <Icon className={`h-5 w-5 ${meta.accent}`} />
        <h2 className="font-serif text-xl font-bold tracking-tight">{meta.label}</h2>
        <Badge variant="outline" className="border-border/60 text-[10px]">
          {items.length}
        </Badge>
      </div>

      {/* Render varía según el tipo */}
      {type === "announcement" && <AnnouncementList items={items} />}
      {type === "tip" && <TipList items={items} />}
      {type === "event" && <EventList items={items} />}
      {type === "link" && <LinkList items={items} />}
      {type === "new_arrival" && <NewArrivalList items={items} />}
      {type === "featured_cat" && <FeaturedCategoryList items={items} />}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 📣 Anuncios — card grande con título + body
// ─────────────────────────────────────────────────────────────
function AnnouncementList({ items }: { items: CreatorWidget[] }) {
  return (
    <ul className="space-y-3">
      {items.map((w) => (
        <li key={w.id}>
          <Card className="border-amber-400/40 bg-amber-400/5 p-4">
            <h3 className="font-serif text-base font-bold">{w.title}</h3>
            {w.body && (
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {w.body}
              </p>
            )}
            {w.url && (
              <a
                href={w.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-500 hover:underline"
              >
                Saber más <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────
// 💡 Tips — cards compactas tipo "consejo"
// ─────────────────────────────────────────────────────────────
function TipList({ items }: { items: CreatorWidget[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((w) => (
        <Card
          key={w.id}
          className="border-emerald-400/30 bg-emerald-400/5 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-emerald-400/20 p-1.5 shrink-0">
              <Lightbulb className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium leading-tight">{w.title}</h3>
              {w.body && (
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                  {w.body}
                </p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 📅 Eventos — lista con fechas
// ─────────────────────────────────────────────────────────────
function EventList({ items }: { items: CreatorWidget[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((w) => (
        <li key={w.id}>
          <Card className="border-violet-400/30 bg-violet-400/5 p-4">
            <div className="flex items-start gap-3">
              {w.starts_at && (
                <div className="flex flex-col items-center rounded-md bg-violet-400/20 px-3 py-2 shrink-0">
                  <span className="text-[10px] uppercase tracking-wide text-violet-400">
                    {new Date(w.starts_at).toLocaleDateString("es", { month: "short" })}
                  </span>
                  <span className="font-serif text-xl font-bold leading-none">
                    {new Date(w.starts_at).getDate()}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-medium leading-tight">{w.title}</h3>
                {w.starts_at && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(w.starts_at).toLocaleString("es", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {w.ends_at && (
                      <>
                        {" — "}
                        {new Date(w.ends_at).toLocaleTimeString("es", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </p>
                )}
                {w.body && (
                  <p className="mt-1.5 whitespace-pre-line text-sm text-foreground/90">
                    {w.body}
                  </p>
                )}
                {w.url && (
                  <a
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:underline"
                  >
                    Detalles <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────
// 🔗 Acceso directo — botones grandes con link
// ─────────────────────────────────────────────────────────────
function LinkList({ items }: { items: CreatorWidget[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((w) =>
        w.url ? (
          <a
            key={w.id}
            href={w.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 transition-colors hover:border-rose-400/60 hover:bg-rose-400/10"
          >
            <div className="rounded-md bg-rose-400/20 p-2 shrink-0">
              <LinkIcon className="h-4 w-4 text-rose-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-sm font-medium">{w.title}</div>
              {w.body && (
                <div className="line-clamp-1 text-xs text-muted-foreground">
                  {w.body}
                </div>
              )}
            </div>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-rose-400/60 transition-colors group-hover:text-rose-400" />
          </a>
        ) : null
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 📚 Nuevas adquisiciones — libros con portada
// ─────────────────────────────────────────────────────────────
function NewArrivalList({ items }: { items: CreatorWidget[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((w) => (
        <Card key={w.id} className="border-border/60 bg-card p-3">
          <div className="flex gap-3">
            {w.book?.cover ? (
              <Link
                href={`/libro/${w.book.slug}`}
                className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md border border-border/40"
              >
                <Image
                  src={w.book.cover}
                  alt={w.book.title}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </Link>
            ) : (
              <div className="h-20 w-14 shrink-0 rounded-md bg-primary/15 flex items-center justify-center">
                <BookPlus className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 font-medium leading-tight">
                {w.title}
              </h3>
              {w.book && (
                <Link
                  href={`/libro/${w.book.slug}`}
                  className="mt-0.5 line-clamp-1 text-xs text-muted-foreground hover:text-primary"
                >
                  {w.book.title}
                </Link>
              )}
              {w.body && (
                <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">
                  “{w.body}”
                </p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 🗂️ Categorías destacadas — chips clicables
// ─────────────────────────────────────────────────────────────
function FeaturedCategoryList({ items }: { items: CreatorWidget[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((w) =>
        w.category ? (
          <Link
            key={w.id}
            href={`/catalogo?category=${w.category.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-400/20 hover:text-sky-200"
          >
            <Folder className="h-3 w-3" />
            {w.title || w.category.name}
          </Link>
        ) : (
          <span
            key={w.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-300"
          >
            <Folder className="h-3 w-3" />
            {w.title}
          </span>
        )
      )}
    </div>
  );
}
