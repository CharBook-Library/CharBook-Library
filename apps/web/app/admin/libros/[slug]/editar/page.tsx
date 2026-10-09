import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BookForm } from "@/components/admin/book-form";
import { AffiliateLinksEditor } from "@/components/admin/affiliate-links-editor";
import { api } from "@/lib/api";

export const metadata = { title: "Editar libro" };

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EditBookPage({ params }: Props) {
  const { slug } = await params;
  let book;
  try {
    const res = await api.books.get(slug);
    book = res.data;
  } catch {
    notFound();
  }

  return (
    <div className="p-6 md:p-8">
      <Link
        href="/admin/libros"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al listado
      </Link>

      <h1 className="font-serif text-3xl font-bold tracking-tight">Editar libro</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Actualiza información, sube nueva portada o archivo.
      </p>

      <div className="space-y-8">
        <BookForm mode="edit" initial={book} />

        {/* ===== Affiliate Links (solo en edit, después de tener slug) ===== */}
        <AffiliateLinksEditor bookSlug={book.slug} />
      </div>
    </div>
  );
}
