import './globals.css';

export const metadata = {
  title: 'Gestor de Firmas IOFE',
  description: 'Aplicación de gestión de firmas digitales',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
