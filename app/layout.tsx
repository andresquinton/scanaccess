import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'Acceso · Control de asistencia',description:'Acreditaciones, entradas y asistencia, en un solo lugar.',appleWebApp:{capable:true,title:'Acceso',statusBarStyle:'default'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
