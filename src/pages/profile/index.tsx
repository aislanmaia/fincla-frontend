import { useLocation, Redirect } from 'wouter';
import { ProfileLayout } from '@/layouts/ProfileLayout';
import ProfileMeSection from './ProfileMeSection';
import ProfileOrganizacoesSection from './ProfileOrganizacoesSection';
import ProfileSegurancaSection from './ProfileSegurancaSection';
import ProfileWhatsAppSection from './ProfileWhatsAppSection';
import ProfileCategoriasSection from './ProfileCategoriasSection';
import ProfileAssinaturaSection from './ProfileAssinaturaSection';

const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  me: ProfileMeSection,
  organizacoes: ProfileOrganizacoesSection,
  seguranca: ProfileSegurancaSection,
  whatsapp: ProfileWhatsAppSection,
  categorias: ProfileCategoriasSection,
  assinatura: ProfileAssinaturaSection,
};

export default function ProfilePage() {
  const [location] = useLocation();
  const section = location.replace('/profile/', '').replace('/profile', '') || 'me';

  // Redirect /profile to /profile/me
  if (location === '/profile' || location === '/profile/') {
    return <Redirect to="/profile/me" />;
  }

  const SectionComponent = SECTION_COMPONENTS[section];

  if (!SectionComponent) {
    return <Redirect to="/profile/me" />;
  }

  return (
    <ProfileLayout>
      <SectionComponent />
    </ProfileLayout>
  );
}
