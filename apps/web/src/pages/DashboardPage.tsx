import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Bot as BotIcon, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/Layout';
import { api } from '@/lib/api';

interface BotItem {
  id: string;
  name: string;
  telegramBotId: string;
  telegramUsername: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { respondents: number; blocks: number };
}

export function DashboardPage() {
  const [showForm, setShowForm] = useState(false);
  const [botName, setBotName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [formError, setFormError] = useState('');
  const queryClient = useQueryClient();

  const { data: bots, isLoading } = useQuery<BotItem[]>({
    queryKey: ['bots'],
    queryFn: async () => {
      const res = await api.get('/bots');
      return res.data.data;
    },
  });

  const createBot = useMutation({
    mutationFn: async (data: { name: string; token: string }) => {
      const res = await api.post('/bots', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      setShowForm(false);
      setBotName('');
      setBotToken('');
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Ошибка при создании бота');
    },
  });

  const deleteBot = useMutation({
    mutationFn: async (botId: string) => {
      await api.delete(`/bots/${botId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
    },
  });

  const handleCreateBot = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    createBot.mutate({ name: botName, token: botToken });
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Мои боты</h1>
          <p className="text-muted-foreground mt-1">Управляйте своими опросными Telegram-ботами</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить бота
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Подключить нового бота</CardTitle>
            <CardDescription>
              Создайте бота через{' '}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                @BotFather
              </a>
              {' '}и вставьте полученный токен
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateBot} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="botName">Название (для себя)</Label>
                  <Input
                    id="botName"
                    placeholder="Мой опрос"
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="botToken">Токен API</Label>
                  <Input
                    id="botToken"
                    placeholder="123456:ABC-DEF..."
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createBot.isPending}>
                  {createBot.isPending ? 'Подключение...' : 'Подключить'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      )}

      {bots && bots.length === 0 && !showForm && (
        <Card className="text-center py-12">
          <CardContent>
            <BotIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Нет подключённых ботов</h2>
            <p className="text-muted-foreground mb-4">
              Подключите своего первого Telegram-бота, чтобы начать создавать опросы
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить бота
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bots?.map((bot) => (
          <Card key={bot.id} className="relative group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{bot.name}</CardTitle>
                  <CardDescription>@{bot.telegramUsername}</CardDescription>
                </div>
                <Badge variant={bot.isActive ? 'default' : 'secondary'}>
                  {bot.isActive ? 'Активен' : 'Неактивен'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {bot._count.blocks} блоков
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {bot._count.respondents} респондентов
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" className="flex-1">
                  <Link to={`/bots/${bot.id}`}>Открыть</Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm('Удалить бота? Все данные будут потеряны.')) {
                      deleteBot.mutate(bot.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
