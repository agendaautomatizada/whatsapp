import { MadeWithDyad } from "@/components/made-with-dyad";
import FeatureCards from "@/components/FeatureCards";
// import ImageGallery from "@/components/ImageGallery"; // Importar la galería

const Dashboard = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl md:text-3xl font-semibold">Bienvenido a tu Bandeja Omni-WhatsApp</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Aquí verás un resumen de tus conversaciones y alertas importantes.
        </p>
        <p className="text-sm md:text-base text-muted-foreground">
          ¡Comienza a explorar el Inbox o configura tus plantillas!
        </p>
      </div>
      <FeatureCards />
      {/* <ImageGallery /> Galería de imágenes para desarrollo */}
      <MadeWithDyad />
    </div>
  );
};

export default Dashboard;