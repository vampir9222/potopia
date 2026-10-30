"use client";

import {
  createContext,
  useContext,
  useMemo,
  type AnchorHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from "react";

/** Composant de lien interne : `<a>` par défaut, `Link` de Next une fois branché par l'app. */
export type LinkComponent = ComponentType<
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>;

type Navigation = { Link: LinkComponent; navigate: (href: string) => void };

function PlainLink(props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props} />;
}

// Hors de l'app Next (tests, futur serveur temps réel) : liens et navigation classiques.
const NavigationContext = createContext<Navigation>({
  Link: PlainLink,
  navigate: (href) => window.location.assign(href),
});

/**
 * Branche la navigation de l'app sur les composants des packages, qui n'importent jamais Next :
 * `apps/web` y passe `Link` et `router.push`. Sans rechargement de page, le layout reste monté
 * (la musique du header continue, par exemple).
 */
export function NavigationProvider({
  link,
  navigate,
  children,
}: {
  link: LinkComponent;
  navigate: (href: string) => void;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ Link: link, navigate }), [link, navigate]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

/** Lien vers une page du site, sans recharger la page. Pour un lien externe ou un téléchargement : `<a>`. */
export function AppLink(props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const { Link } = useContext(NavigationContext);
  return <Link {...props} />;
}

/** Aller sur une page du site depuis du code (après une action, par exemple), sans rechargement. */
export function useNavigate(): (href: string) => void {
  return useContext(NavigationContext).navigate;
}
