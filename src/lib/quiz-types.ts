import type { Timestamp } from 'firebase/firestore';
import { t } from '$lib/i18n';

export type QuestionType = 'multiple-choice' | 'multiple-answer' | 'true-false' | 'short-answer';

export interface Option {
	id: string;
	value: string;
}

export interface Question {
	id: string;
	type: QuestionType;
	prompt: string;
	options: Option[];
	correctAnswer: string | string[];
	explanation: string;
	points: number;
	imageUrl?: string;
}

export interface Quiz {
	id: string;
	title: string;
	questions: Question[];
	passingScore: number;
	shuffleQuestions: boolean;
	createdAt: Timestamp;
}

export interface QuizAttempt {
	id: string;
	quizId: string;
	userId: string;
	score: number;
	totalPoints: number;
	passed: boolean;
	answers: { questionId: string; answer: string | string[]; correct: boolean }[];
	startedAt: Timestamp;
	completedAt: Timestamp;
}

export function getOptionLabel(options: Option[], id: string): string {
	return options.find((o) => o.id === id)?.value ?? id;
}

export function getQuestionTypeLabel(type: QuestionType): string {
	switch (type) {
		case 'multiple-choice':
			return t('quiz.questionTypeMultipleChoice');
		case 'multiple-answer':
			return t('quiz.questionTypeMultipleAnswer');
		case 'true-false':
			return t('quiz.questionTypeTrueFalse');
		case 'short-answer':
			return t('quiz.questionTypeShortAnswer');
	}
}
