import { useOrganization } from '@/hooks/useOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building } from 'lucide-react';

export default function ProfileOrganizacoesSection() {
  const { organizations, activeOrgId, selectOrganization } = useOrganization();

  return (
    <Card className="shadow-flat border-0 rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5 text-indigo-500" />
          Organizações
        </CardTitle>
        <CardDescription>Gerencie seus espaços de trabalho</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {organizations.map((org) => (
            <div
              key={org.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                activeOrgId === org.id
                  ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800'
                  : 'bg-white border-gray-100 hover:border-gray-200 dark:bg-gray-800 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-2 rounded-lg ${
                    activeOrgId === org.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{org.name}</p>
                  <p className="text-xs text-gray-500">ID: {org.id}</p>
                </div>
              </div>
              {activeOrgId === org.id ? (
                <Badge className="bg-indigo-600">Ativa</Badge>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => selectOrganization(org.id)}>
                  Alternar
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
