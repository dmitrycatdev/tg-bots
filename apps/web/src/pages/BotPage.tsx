import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/Layout';
import { ScenarioBuilder } from '@/components/ScenarioBuilder';
import { AnswersTable } from '@/components/AnswersTable';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface BotDetails {
  id: string;
  name: string;
  telegramUsername: string;
  isActive: boolean;
  _count: { respondents: number; blocks: number };
}

type Tab = 'scenario' | 'answers';

export function BotPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('scenario');

  const { data: bot, isLoading } = useQuery<BotDetails>({
    queryKey: ['bot', id],
    queryFn: async () => {
      const res = await api.get(`/bots/${id}`);
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      </Layout>
    );
  }

  if (!bot) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Бот не найден</p>
          <Button asChild>
            <Link to="/dashboard">Вернуться</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            К списку ботов
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{bot.name}</h1>
            <p className="text-muted-foreground">@{bot.telegramUsername}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'scenario'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setActiveTab('scenario')}
        >
          Сценарий
        </button>
        <button
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'answers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setActiveTab('answers')}
        >
          Ответы ({bot._count.respondents})
        </button>
      </div>

      {activeTab === 'scenario' && <ScenarioBuilder botId={id!} />}
      {activeTab === 'answers' && <AnswersTable botId={id!} />}
    </Layout>
  );
}
