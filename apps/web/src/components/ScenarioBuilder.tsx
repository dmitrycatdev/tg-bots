import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  MessageSquare,
  Mail,
  Play,
  Flag,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/RichTextEditor';
import { api } from '@/lib/api';
import { BlockType, AnswerType, RATING_MIN, RATING_MAX } from '@tg-bots/shared';
import type { Block } from '@tg-bots/shared';
import { cn } from '@/lib/utils';

interface ScenarioBuilderProps {
  botId: string;
}

const blockTypeLabels: Record<string, string> = {
  [BlockType.START]: 'Старт',
  [BlockType.QUESTION]: 'Вопрос',
  [BlockType.MESSAGE]: 'Сообщение',
  [BlockType.FINISH]: 'Финал',
};

const CHOICE_KEY = 'CHOICE';

const selectableAnswerTypes: { value: string; label: string }[] = [
  { value: AnswerType.TEXT, label: 'Текст' },
  { value: CHOICE_KEY, label: 'Вариант' },
  { value: AnswerType.RATING, label: 'Оценка (1–5)' },
];

const answerTypeBadgeLabels: Record<string, string> = {
  [AnswerType.TEXT]: 'Текст',
  [AnswerType.SINGLE_CHOICE]: 'Вариант',
  [AnswerType.MULTI_CHOICE]: 'Вариант (множ.)',
  [AnswerType.RATING]: 'Оценка (1–5)',
};

const blockTypeIcons: Record<string, React.ReactNode> = {
  [BlockType.START]: <Play className="h-4 w-4" />,
  [BlockType.QUESTION]: <MessageSquare className="h-4 w-4" />,
  [BlockType.MESSAGE]: <Mail className="h-4 w-4" />,
  [BlockType.FINISH]: <Flag className="h-4 w-4" />,
};

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').trim();
}

function toDisplayHtml(value: string) {
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(value);
  if (looksLikeHtml) return value;
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '<br>');
}

export function ScenarioBuilder({ botId }: ScenarioBuilderProps) {
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [addBlockType, setAddBlockType] = useState<BlockType.QUESTION | BlockType.MESSAGE | null>(null);
  const queryClient = useQueryClient();

  const { data: blocks = [], isLoading } = useQuery<Block[]>({
    queryKey: ['blocks', botId],
    queryFn: async () => {
      const res = await api.get(`/bots/${botId}/blocks`);
      return res.data.data;
    },
  });

  const createBlock = useMutation({
    mutationFn: async (data: Partial<Block>) => {
      const res = await api.post(`/bots/${botId}/blocks`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', botId] });
      setAddBlockType(null);
    },
  });

  const updateBlock = useMutation({
    mutationFn: async ({ blockId, data }: { blockId: string; data: Partial<Block> }) => {
      const res = await api.put(`/bots/${botId}/blocks/${blockId}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', botId] });
      setEditingBlockId(null);
    },
  });

  const deleteBlock = useMutation({
    mutationFn: async (blockId: string) => {
      await api.delete(`/bots/${botId}/blocks/${blockId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', botId] });
    },
  });

  const reorderBlocks = useMutation({
    mutationFn: async (blockIds: string[]) => {
      const res = await api.put(`/bots/${botId}/blocks-reorder`, { blockIds });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', botId] });
    },
  });

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // Can't move START or FINISH, can't move past them
    if (
      targetIndex < 0 ||
      targetIndex >= newBlocks.length ||
      newBlocks[targetIndex].type === BlockType.START ||
      newBlocks[targetIndex].type === BlockType.FINISH ||
      newBlocks[index].type === BlockType.START ||
      newBlocks[index].type === BlockType.FINISH
    ) {
      return;
    }

    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    reorderBlocks.mutate(newBlocks.map((b) => b.id));
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Загрузка сценария...</div>;
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {blocks.map((block, index) => {
        const isLastBeforeFinish = index < blocks.length - 1 && blocks[index + 1]?.type === BlockType.FINISH;
        const isInsertVisible = isLastBeforeFinish && !addBlockType;

        return (
          <div key={block.id}>
            <BlockCard
              block={block}
              index={index}
              totalBlocks={blocks.length}
              isEditing={editingBlockId === block.id}
              onEdit={() => setEditingBlockId(editingBlockId === block.id ? null : block.id)}
              onSave={(data) => updateBlock.mutate({ blockId: block.id, data })}
              onDelete={() => {
                if (confirm('Удалить этот блок?')) {
                  deleteBlock.mutate(block.id);
                }
              }}
              onMoveUp={() => moveBlock(index, 'up')}
              onMoveDown={() => moveBlock(index, 'down')}
              isSaving={updateBlock.isPending}
            />

            {isInsertVisible && (
              <div className="flex justify-center gap-2 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddBlockType(BlockType.QUESTION)}
                  className="border-dashed"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить вопрос
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddBlockType(BlockType.MESSAGE)}
                  className="border-dashed"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить сообщение
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {blocks.length <= 2 && !addBlockType && (
        <div className="flex justify-center gap-2 py-4">
          <Button
            variant="outline"
            onClick={() => setAddBlockType(BlockType.QUESTION)}
            className="border-dashed"
          >
            <Plus className="mr-2 h-4 w-4" />
            Добавить вопрос
          </Button>
          <Button
            variant="outline"
            onClick={() => setAddBlockType(BlockType.MESSAGE)}
            className="border-dashed"
          >
            <Plus className="mr-2 h-4 w-4" />
            Добавить сообщение
          </Button>
        </div>
      )}

      {addBlockType && (
        <NewBlockForm
          blockType={addBlockType}
          onSubmit={(data) => createBlock.mutate(data)}
          onCancel={() => setAddBlockType(null)}
          isLoading={createBlock.isPending}
        />
      )}
    </div>
  );
}

// =================== BlockCard ===================

interface BlockCardProps {
  block: Block;
  index: number;
  totalBlocks: number;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (data: Partial<Block>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isSaving: boolean;
}

function BlockCard({
  block,
  index,
  totalBlocks,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  isSaving,
}: BlockCardProps) {
  const [editText, setEditText] = useState(block.text);
  const isBlockChoice = block.answerType === AnswerType.SINGLE_CHOICE || block.answerType === AnswerType.MULTI_CHOICE;
  const [editSelectValue, setEditSelectValue] = useState(
    isBlockChoice ? CHOICE_KEY : (block.answerType || AnswerType.TEXT),
  );
  const [editMultiple, setEditMultiple] = useState(block.answerType === AnswerType.MULTI_CHOICE);
  const [editOptions, setEditOptions] = useState<string[]>(
    Array.isArray(block.options) ? (block.options as string[]) : [],
  );
  const [editButtonText, setEditButtonText] = useState(block.buttonText || '');

  const isQuestion = block.type === BlockType.QUESTION;
  const isMessage = block.type === BlockType.MESSAGE;
  const isMovable = isQuestion || isMessage;
  const isDeletable = isQuestion || isMessage;
  const isChoice = editSelectValue === CHOICE_KEY;
  const isOptionsVisible = isQuestion
    && (block.answerType === AnswerType.SINGLE_CHOICE || block.answerType === AnswerType.MULTI_CHOICE)
    && Array.isArray(block.options) && block.options.length > 0;
  const isMultiWithButton = block.answerType === AnswerType.MULTI_CHOICE && !!block.buttonText;
  const isRating = isQuestion && block.answerType === AnswerType.RATING;

  const handleSave = () => {
    const data: any = { text: editText };
    if (isQuestion) {
      if (isChoice) {
        data.answerType = editMultiple ? AnswerType.MULTI_CHOICE : AnswerType.SINGLE_CHOICE;
        data.options = editOptions.filter((o) => o.trim());
        data.buttonText = editMultiple ? (editButtonText.trim() || null) : null;
      } else {
        data.answerType = editSelectValue;
        data.options = null;
        data.buttonText = null;
      }
    }
    onSave(data);
  };

  return (
    <Card
      className={cn(
        'transition-shadow',
        isEditing && 'ring-2 ring-primary',
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isMovable && <GripVertical className="h-4 w-4 text-muted-foreground" />}
            <span className="text-muted-foreground">{blockTypeIcons[block.type]}</span>
            <CardTitle className="text-base">
              {blockTypeLabels[block.type]}
              {isQuestion && block.answerType && (
                <Badge variant="secondary" className="ml-2 font-normal">
                  {answerTypeBadgeLabels[block.answerType]}
                </Badge>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {isMovable && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onMoveUp}
                  disabled={index <= 1}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onMoveDown}
                  disabled={index >= totalBlocks - 2}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </>
            )}
            {isDeletable && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!isEditing ? (
          <div
            className="cursor-pointer rounded-md p-3 bg-muted/50 hover:bg-muted transition-colors text-sm"
            onClick={onEdit}
          >
            <div dangerouslySetInnerHTML={{ __html: toDisplayHtml(block.text) }} />
            {isOptionsVisible && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(block.options as string[]).map((opt, i) => (
                  <Badge key={i} variant="outline" className="font-normal">
                    {opt}
                  </Badge>
                ))}
                {isMultiWithButton && (
                  <Badge variant="secondary" className="font-normal">
                    {block.buttonText}
                  </Badge>
                )}
              </div>
            )}
            {isRating && (
              <div className="mt-2 flex gap-1">
                {Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => (
                  <Badge key={i} variant="outline" className="font-normal">
                    {RATING_MIN + i}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Текст</Label>
              <RichTextEditor value={editText} onChange={setEditText} />
            </div>

            {isQuestion && (
              <>
                <div className="space-y-2">
                  <Label>Тип ответа</Label>
                  <Select
                    value={editSelectValue}
                    onChange={(e) => setEditSelectValue(e.target.value)}
                  >
                    {selectableAnswerTypes.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>

                {isChoice && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editMultiple}
                        onChange={(e) => setEditMultiple(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm">Множественный выбор</span>
                    </label>

                    <OptionsEditor options={editOptions} onChange={setEditOptions} />

                    {editMultiple && (
                      <div className="space-y-2">
                        <Label>Текст кнопки «Продолжить»</Label>
                        <Input
                          value={editButtonText}
                          onChange={(e) => setEditButtonText(e.target.value)}
                          placeholder="Продолжить ▸"
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </Button>
              <Button size="sm" variant="outline" onClick={onEdit}>
                Отмена
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =================== OptionsEditor ===================

interface OptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
}

function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const addOption = () => {
    onChange([...options, '']);
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onChange(newOptions);
  };

  return (
    <div className="space-y-2">
      <Label>Варианты ответа</Label>
      {options.map((opt, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={opt}
            onChange={(e) => updateOption(index, e.target.value)}
            placeholder={`Вариант ${index + 1}`}
          />
          <Button variant="ghost" size="icon" onClick={() => removeOption(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addOption}>
        <Plus className="mr-2 h-4 w-4" />
        Добавить вариант
      </Button>
    </div>
  );
}

// =================== NewBlockForm ===================

interface NewBlockFormProps {
  blockType: BlockType.QUESTION | BlockType.MESSAGE;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function NewBlockForm({ blockType, onSubmit, onCancel, isLoading }: NewBlockFormProps) {
  const [text, setText] = useState('');
  const [selectValue, setSelectValue] = useState<string>(AnswerType.TEXT);
  const [multiple, setMultiple] = useState(false);
  const [options, setOptions] = useState<string[]>(['', '']);
  const [buttonText, setButtonText] = useState('');

  const isQuestion = blockType === BlockType.QUESTION;
  const isChoice = selectValue === CHOICE_KEY;
  const title = isQuestion ? 'Новый вопрос' : 'Новое сообщение';
  const placeholder = isQuestion ? 'Введите текст вопроса...' : 'Введите текст сообщения...';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripHtml(text)) return;

    const data: any = { type: blockType, text };
    if (isQuestion) {
      if (isChoice) {
        data.answerType = multiple ? AnswerType.MULTI_CHOICE : AnswerType.SINGLE_CHOICE;
        data.options = options.filter((o) => o.trim());
        data.buttonText = multiple ? (buttonText.trim() || null) : null;
      } else {
        data.answerType = selectValue;
      }
    }
    onSubmit(data);
  };

  return (
    <Card className="ring-2 ring-primary">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Текст</Label>
            <RichTextEditor value={text} onChange={setText} placeholder={placeholder} />
            {!stripHtml(text) && (
              <p className="text-xs text-destructive">Введите текст блока</p>
            )}
          </div>

          {isQuestion && (
            <>
              <div className="space-y-2">
                <Label>Тип ответа</Label>
                <Select
                  value={selectValue}
                  onChange={(e) => setSelectValue(e.target.value)}
                >
                  {selectableAnswerTypes.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              {isChoice && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={multiple}
                      onChange={(e) => setMultiple(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Множественный выбор</span>
                  </label>

                  <OptionsEditor options={options} onChange={setOptions} />

                  {multiple && (
                    <div className="space-y-2">
                      <Label>Текст кнопки «Продолжить»</Label>
                      <Input
                        value={buttonText}
                        onChange={(e) => setButtonText(e.target.value)}
                        placeholder="Продолжить ▸"
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading || !stripHtml(text)}>
              {isLoading ? 'Добавление...' : 'Добавить'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Отмена
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
