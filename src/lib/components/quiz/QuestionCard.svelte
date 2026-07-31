<script lang="ts">
	import { Plus, Trash2, ChevronDown } from '@lucide/svelte';
	import type { Option, Question, QuestionType } from '$lib/quiz-types';
	import { QUESTION_TYPE_LABELS } from '$lib/quiz-types';

	const fieldClass =
		'w-full rounded-md bg-white px-3 py-2 text-[14px] text-ink-900 placeholder:text-ink-300 outline-1 -outline-offset-1 outline-ink-900/15 focus:outline-2 focus:-outline-offset-2 focus:outline-iris-500 transition';
	const labelClass = 'mb-1.5 block text-[12.5px] font-medium text-ink-700';

	function makeId() {
		return typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `q-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}

	let {
		question,
		index,
		expanded = false,
		onupdate,
		ondelete,
		ontoggle
	}: {
		question: Question;
		index: number;
		expanded: boolean;
		onupdate: (patch: Partial<Question>) => void;
		ondelete: () => void;
		ontoggle: () => void;
	} = $props();

	function handleTypeChange(type: QuestionType) {
		let options: Option[] = [];
		let correctAnswer: string | string[] = '';
		if (type === 'true-false') {
			options = [
				{ id: 'tf-true', value: 'True' },
				{ id: 'tf-false', value: 'False' }
			];
			correctAnswer = 'tf-true';
		} else if (type === 'multiple-choice' || type === 'multiple-answer') {
			options =
				question.options.length > 0
					? question.options
					: [{ id: makeId(), value: '' }, { id: makeId(), value: '' }];
		}
		onupdate({ type, options, correctAnswer });
	}

	function updateOption(i: number, value: string) {
		const opts = [...question.options];
		opts[i] = { ...opts[i], value };
		onupdate({ options: opts });
	}

	function addOption() {
		onupdate({ options: [...question.options, { id: makeId(), value: '' }] });
	}

	function removeOption(i: number) {
		const opts = question.options.filter((_, idx) => idx !== i);
		const removedId = question.options[i]?.id;
		let correct = question.correctAnswer;
		if (Array.isArray(correct)) {
			correct = correct.filter((a) => a !== removedId);
		} else if (correct === removedId) {
			correct = '';
		}
		onupdate({ options: opts, correctAnswer: correct });
	}
</script>

<div class="rounded-xl border border-ink-900/10 bg-white shadow-soft">
	<button onclick={ontoggle} class="flex w-full items-center gap-3 px-5 py-4 text-left">
		<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-iris-50 text-[13px] font-semibold text-iris-600">
			{index + 1}
		</span>
		<div class="min-w-0 flex-1">
			<p class="truncate text-[14px] font-medium text-ink-900">
				{question.prompt || 'New question'}
			</p>
			<p class="text-[12.5px] text-ink-400">
				{QUESTION_TYPE_LABELS[question.type]} · {question.points} pt{question.points !== 1 ? 's' : ''}
			</p>
		</div>
		<ChevronDown class="h-4 w-4 shrink-0 text-ink-400 transition {expanded ? 'rotate-180' : ''}" />
	</button>

	{#if expanded}
		<div class="border-t border-ink-900/10 px-5 pb-5 pt-4 space-y-4">
			<div class="flex gap-3">
				<div class="flex-1">
					<label class={labelClass}>Type</label>
					<div class="relative">
						<select
							value={question.type}
							onchange={(e) => handleTypeChange((e.target as HTMLSelectElement).value as QuestionType)}
							class="{fieldClass} appearance-none pr-8"
						>
							{#each Object.keys(QUESTION_TYPE_LABELS) as type}
								<option value={type}>{QUESTION_TYPE_LABELS[type as QuestionType]}</option>
							{/each}
						</select>
						<ChevronDown class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
					</div>
				</div>
				<div class="w-24">
					<label class={labelClass}>Points</label>
					<input
						type="number"
						min={1}
						value={question.points}
						onchange={(e) => onupdate({ points: Math.max(1, Number((e.target as HTMLInputElement).value)) })}
						class={fieldClass}
					/>
				</div>
			</div>

			<div>
				<label class={labelClass}>Question</label>
				<textarea
					value={question.prompt}
					oninput={(e) => onupdate({ prompt: (e.target as HTMLTextAreaElement).value })}
					rows={2}
					class="{fieldClass} resize-none"
					placeholder="Type your question here…"
				></textarea>
			</div>

			{#if question.type === 'multiple-choice' || question.type === 'multiple-answer'}
				<div>
					<label class={labelClass}>
						Options
						{#if question.type === 'multiple-choice'}
							(select one correct answer)
						{:else}
							(select all correct answers)
						{/if}
					</label>
					<div class="space-y-2">
						{#each question.options as opt, i (opt.id)}
							<div class="flex items-center gap-2">
								{#if question.type === 'multiple-choice'}
									<input
										type="radio"
										name="correct-{question.id}"
										checked={question.correctAnswer === opt.id}
										onchange={() => onupdate({ correctAnswer: opt.id })}
										class="h-4 w-4 shrink-0 accent-iris-500"
									/>
								{:else}
									<input
										type="checkbox"
										checked={Array.isArray(question.correctAnswer) && question.correctAnswer.includes(opt.id)}
										onchange={(e) => {
											const arr = Array.isArray(question.correctAnswer)
												? [...question.correctAnswer]
												: [];
											if ((e.target as HTMLInputElement).checked) {
												onupdate({ correctAnswer: [...arr, opt.id] });
											} else {
												onupdate({ correctAnswer: arr.filter((a) => a !== opt.id) });
											}
										}}
										class="h-4 w-4 shrink-0 accent-iris-500"
									/>
								{/if}
								<input
									value={opt.value}
									oninput={(e) => updateOption(i, (e.target as HTMLInputElement).value)}
									class="{fieldClass} !py-1.5"
									placeholder="Option {i + 1}"
								/>
								<button
									onclick={() => removeOption(i)}
									class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-300 hover:bg-red-50 hover:text-red-500"
								>
									<Trash2 class="h-3.5 w-3.5" />
								</button>
							</div>
						{/each}
					</div>
					<button
						onclick={addOption}
						class="mt-2 flex items-center gap-1 text-[13px] font-medium text-iris-600 hover:text-iris-700"
					>
						<Plus class="h-3.5 w-3.5" />
						Add option
					</button>
				</div>
			{/if}

			{#if question.type === 'true-false'}
				<div>
					<label class={labelClass}>Correct answer</label>
					<div class="flex gap-3">
						{#each question.options as opt (opt.id)}
							<label
								class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2 text-[14px] font-medium transition {question.correctAnswer === opt.id
									? 'border-iris-400 bg-iris-50 text-iris-700'
									: 'border-ink-900/10 text-ink-600 hover:border-ink-900/20'}"
							>
								<input
									type="radio"
									name="tf-{question.id}"
									value={opt.id}
									checked={question.correctAnswer === opt.id}
									onchange={() => onupdate({ correctAnswer: opt.id })}
									class="hidden"
								/>
								{opt.value}
							</label>
						{/each}
					</div>
				</div>
			{/if}

			{#if question.type === 'short-answer'}
				<div>
					<label class={labelClass}>Correct answer (keyword match)</label>
					<input
						value={(question.correctAnswer as string) || ''}
						oninput={(e) => onupdate({ correctAnswer: (e.target as HTMLInputElement).value })}
						class={fieldClass}
						placeholder="e.g. Hypertension"
					/>
					<p class="mt-1 text-[12px] text-ink-400">
						Grading is case-insensitive; the student's answer must contain this keyword.
					</p>
				</div>
			{/if}

			<div>
				<label class={labelClass}>
					Explanation
					<span class="font-normal text-ink-300"> (shown after student answers)</span>
				</label>
				<textarea
					value={question.explanation || ''}
					oninput={(e) => onupdate({ explanation: (e.target as HTMLTextAreaElement).value })}
					rows={2}
					class="{fieldClass} resize-none"
					placeholder="Explain why the correct answer is right…"
				></textarea>
			</div>

			<div class="flex justify-end border-t border-ink-900/10 pt-3">
				<button
					onclick={ondelete}
					class="flex items-center gap-1.5 text-[13px] font-medium text-red-500 hover:text-red-600"
				>
					<Trash2 class="h-3.5 w-3.5" />
					Delete question
				</button>
			</div>
		</div>
	{/if}
</div>
