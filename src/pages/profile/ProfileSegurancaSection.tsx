import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Key } from 'lucide-react';

export default function ProfileSegurancaSection() {
  return (
    <Card className="shadow-flat border-0 rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="w-5 h-5 text-indigo-500" />
          Segurança
        </CardTitle>
        <CardDescription>Gerencie a segurança da sua conta</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/profile/change-password">
          <Button variant="outline" className="w-full sm:w-auto justify-start">
            <Key className="w-4 h-4 mr-2" />
            Alterar Senha
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
