'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        // Check if token exists
        const token = localStorage.getItem('iofe_token');
        setIsLoggedIn(!!token);

        // Redirect to login if not authenticated and not on login page
        if (!token && pathname !== '/') {
            router.push('/');
        }
    }, [pathname, router]);

    const handleLogout = () => {
        localStorage.removeItem('iofe_token');
        router.push('/');
    };

    if (!isLoggedIn) return null;

    return (
        <nav className="navbar">
            <div className="nav-container">
                <Link href="/" className="nav-logo">
                    IOFE Manager
                </Link>
                <div className="nav-links">
                    <NavLink href="/upload" active={pathname === '/upload'}>Cargar</NavLink>
                    <NavLink href="/cancel" active={pathname === '/cancel'}>Anular</NavLink>
                    <NavLink href="/download" active={pathname === '/download'}>Descargar</NavLink>
                    <button onClick={handleLogout} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        Salir
                    </button>
                </div>
            </div>
        </nav>
    );
}

function NavLink({ href, active, children }) {
    return (
        <Link href={href} className={`nav-link ${active ? 'active' : ''}`}>
            {children}
        </Link>
    );
}
