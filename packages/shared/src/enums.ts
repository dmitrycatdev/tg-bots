/** Тип блока сценария */
export enum BlockType {
  START = 'START',
  QUESTION = 'QUESTION',
  MESSAGE = 'MESSAGE',
  FINISH = 'FINISH',
}

/** Тип ответа на вопрос */
export enum AnswerType {
  TEXT = 'TEXT',
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTI_CHOICE = 'MULTI_CHOICE',
  RATING = 'RATING',
}

/** Статус прохождения опроса респондентом */
export enum RespondentStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}
