import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tags } from 'lucide-react';

export default function ProfileCategoriasSection() {
  return (
    <Card className="shadow-flat border-0 rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tags className="w-5 h-5 text-indigo-500" />
          Categorias e Tags
        </CardTitle>
        <CardDescription>
          Gerencie categorias e tags para organizar suas transações
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Em breve você poderá criar, editar e organizar suas categorias e tags personalizadas.
        </p>
      </CardContent>
    </Card>
  );
}
