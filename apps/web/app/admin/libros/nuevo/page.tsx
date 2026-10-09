import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BookForm } from "@/components/admin/book-form";

export const metadata = { title: "Nuevo libro" };

export default function NewBookPage() {
  return (
    <div className="p-6 md:p-8">
      <Link
        href="/admin/libros"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al listado
      </Link>

      <h1 className="font-serif text-3xl font-bold tracking-tight">Nuevo libro</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Sube portada e archivo. La portada irá a R2 público, el archivo a R2 privado con URLs firmadas.
      </p>

      <BookForm mode="create" />
    </div>
  );
}
