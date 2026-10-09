import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Rush Social — The market is a group chat',description:'Big trades. Bad jokes. Good company. The social hangout for MarketRush traders.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
