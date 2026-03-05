import { useQuery } from '@tanstack/react-query';
import { Download, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { RespondentStatus, AnswerType } from '@tg-bots/shared';

interface AnswerColumn {
  id: string;
  text: string;
  answerType: string;
}

interface AnswerRow {
  respondentId: string;
  chatId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  answers: Record<string, string>;
  completedAt: string | null;
}

interface AnswersData {
  columns: AnswerColumn[];
  rows: AnswerRow[];
}

interface AnswersTableProps {
  botId: string;
}

const statusLabels: Record<string, string> = {
  [RespondentStatus.NOT_STARTED]: 'Не начал',
  [RespondentStatus.IN_PROGRESS]: 'В процессе',
  [RespondentStatus.COMPLETED]: 'Завершён',
};

function formatAnswerValue(value: string | undefined, answerType: string): string {
  if (!value) return '';
  if (answerType === AnswerType.MULTI_CHOICE) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.join(', ');
    } catch { /* not JSON, return as-is */ }
  }
  return value;
}

const statusVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  [RespondentStatus.NOT_STARTED]: 'outline',
  [RespondentStatus.IN_PROGRESS]: 'secondary',
  [RespondentStatus.COMPLETED]: 'default',
};

export function AnswersTable({ botId }: AnswersTableProps) {
  const { data, isLoading } = useQuery<AnswersData>({
    queryKey: ['answers', botId],
    queryFn: async () => {
      const res = await api.get(`/bots/${botId}/answers`);
      return res.data.data;
    },
  });

  const handleExport = () => {
    // Use a direct link to download the CSV
    const token = localStorage.getItem('auth-storage');
    let accessToken = '';
    try {
      const parsed = JSON.parse(token || '{}');
      accessToken = parsed?.state?.accessToken || '';
    } catch {
      // Ignore
    }

    // Create a temporary link that fetches with auth
    api
      .get(`/bots/${botId}/answers/export`, { responseType: 'blob' })
      .then((res) => {
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `answers-${botId}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error('Export error:', err);
        alert('Ошибка при экспорте данных');
      });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Загрузка ответов...</div>;
  }

  if (!data || data.rows.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Пока нет ответов</h2>
          <p className="text-muted-foreground">
            Респонденты ещё не начали проходить опрос
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Всего респондентов: {data.rows.length}
        </p>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Экспорт в CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium whitespace-nowrap">Респондент</th>
              <th className="text-left p-3 font-medium whitespace-nowrap">Статус</th>
              {data.columns.map((col) => (
                <th key={col.id} className="text-left p-3 font-medium max-w-[200px]" title={col.text}>
                  <div className="truncate">{col.text}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.respondentId} className="border-b hover:bg-muted/30">
                <td className="p-3 whitespace-nowrap">
                  <div className="font-medium">
                    {row.firstName || row.username || row.chatId}
                  </div>
                  {row.username && (
                    <div className="text-xs text-muted-foreground">@{row.username}</div>
                  )}
                </td>
                <td className="p-3 whitespace-nowrap">
                  <Badge variant={statusVariants[row.status] || 'outline'}>
                    {statusLabels[row.status] || row.status}
                  </Badge>
                </td>
                {data.columns.map((col) => {
                  const display = formatAnswerValue(row.answers[col.id], col.answerType);
                  return (
                    <td key={col.id} className="p-3 max-w-[200px]">
                      <div className="truncate" title={display}>
                        {display || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
