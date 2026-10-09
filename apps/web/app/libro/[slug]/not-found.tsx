import Link from "next/link";
import { BookX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
      <BookX className="mb-6 h-16 w-16 text-primary" />
      <h1 className="font-serif text-3xl font-bold">Libro no encontrado</h1>
      <p className="mt-3 text-muted-foreground">
        El libro que buscas no existe o fue removido del catálogo.
      </p>
      <Button asChild className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90">
        <Link href="/catalogo">Ver catálogo</Link>
      </Button>
    </div>
  );
}
