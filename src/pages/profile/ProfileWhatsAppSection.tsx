import { useOrganization } from '@/hooks/useOrganization';
import { WhatsAppConnectionsSection } from '@/components/profile/WhatsAppConnectionsSection';

export default function ProfileWhatsAppSection() {
  const { activeOrgId } = useOrganization();

  if (!activeOrgId) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione uma organização para gerenciar as conexões WhatsApp.
      </p>
    );
  }

  return <WhatsAppConnectionsSection organizationId={activeOrgId} />;
}
