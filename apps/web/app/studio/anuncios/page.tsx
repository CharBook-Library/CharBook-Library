import { redirect } from "next/navigation";

export default function AnunciosPage() {
  // Anuncios y secciones del perfil viven en widgets
  redirect("/studio/widgets");
}
