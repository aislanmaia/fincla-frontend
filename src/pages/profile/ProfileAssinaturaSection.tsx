import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard } from 'lucide-react';

export default function ProfileAssinaturaSection() {
  return (
    <Card className="shadow-flat border-0 rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-purple-500" />
          Assinatura
        </CardTitle>
        <CardDescription>Detalhes do seu plano atual</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Plano Gratuito</h3>
              <p className="text-sm text-gray-500">Ideal para uso pessoal</p>
            </div>
            <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20">
              Ativo
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Organizações</span>
              <span className="font-medium">1 / 1</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
              <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
          <Button className="w-full mt-6" variant="outline">
            Gerenciar Assinatura
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
