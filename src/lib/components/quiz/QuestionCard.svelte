<script lang="ts">
	import { Plus, Trash2, ChevronDown, X, Bold, Italic, Underline } from '@lucide/svelte';
	import type { Option, Question, QuestionType } from '$lib/quiz-types';
	import { QUESTION_TYPE_LABELS } from '$lib/quiz-types';
	import { storage } from '$lib/firebase';
	import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
	import FileUpload from '$lib/components/ui/FileUpload.svelte';
	import Markdown from '$lib/components/ui/Markdown.svelte';
	import ImageContainer from '$lib/components/ui/ImageContainer.svelte';

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
		ontoggle,
		onremoveimage,
	}: {
		question: Question;
		index: number;
		expanded: boolean;
		onupdate: (patch: Partial<Question>) => void;
		ondelete: () => void;
		ontoggle: () => void;
		onremoveimage?: () => void;
	} = $props();

	let uploadingImage = $state(false);
	let promptMode = $state<'write' | 'preview'>('write');
	let promptEl: HTMLTextAreaElement | undefined = $state();

	type FormatStyle = 'bold' | 'italic' | 'underline';

	const formatMarkers: Record<FormatStyle, { before: string; after: string }> = {
		bold: { before: '**', after: '**' },
		italic: { before: '*', after: '*' },
		underline: { before: '<u>', after: '</u>' },
	};

	function applyFormat(style: FormatStyle) {
		const el = promptEl;
		if (!el) return;
		const { before, after } = formatMarkers[style];
		const { selectionStart: start, selectionEnd: end } = el;
		const selected = question.prompt.slice(start, end);
		const replacement = `${before}${selected || 'text'}${after}`;
		const next = question.prompt.slice(0, start) + replacement + question.prompt.slice(end);
		onupdate({ prompt: next });
		requestAnimationFrame(() => {
			el.focus();
			const newStart = start + before.length;
			el.setSelectionRange(
				newStart,
				newStart + replacement.length - before.length - after.length,
			);
		});
	}

	function handleTypeChange(type: QuestionType) {
		let options: Option[] = [];
		let correctAnswer: string | string[] = '';
		if (type === 'true-false') {
			options = [
				{ id: 'tf-true', value: 'True' },
				{ id: 'tf-false', value: 'False' },
			];
			correctAnswer = 'tf-true';
		} else if (type === 'multiple-choice' || type === 'multiple-answer') {
			options =
				question.options.length > 0
					? question.options
					: [
							{ id: makeId(), value: '' },
							{ id: makeId(), value: '' },
						];
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

	async function handleImageUpload(file: File) {
		uploadingImage = true;
		try {
			const ext = file.name.split('.').pop();
			const storageRef = ref(storage, `quiz-images/${question.id}.${ext}`);
			await uploadBytes(storageRef, file);
			const url = await getDownloadURL(storageRef);
			onupdate({ imageUrl: url });
		} catch (err) {
			console.error(err);
		} finally {
			uploadingImage = false;
		}
	}

	async function removeImage() {
		if (!question.imageUrl) return;
		try {
			const storageRef = ref(storage, question.imageUrl);
			await deleteObject(storageRef);
		} catch (err) {
			console.error(err);
		}
		onupdate({ imageUrl: '' });
		onremoveimage?.();
	}
</script>

<div class="rounded-xl border border-ink-900/10 bg-white shadow-soft">
	<button onclick={ontoggle} class="flex w-full items-center gap-3 px-5 py-4 text-left">
		<span
			class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-iris-50 text-[13px] font-semibold text-iris-600"
		>
			{index + 1}
		</span>
		<div class="min-w-0 flex-1">
			{#if question.prompt}
				<div class="truncate text-[14px] font-medium text-ink-900">
					<Markdown value={question.prompt} />
				</div>
			{:else}
				<p class="truncate text-[14px] font-medium text-ink-900">New question</p>
			{/if}
			<p class="text-[12.5px] text-ink-400">
				{QUESTION_TYPE_LABELS[question.type]} · {question.points} pt{question.points !== 1
					? 's'
					: ''}
			</p>
		</div>
		<ChevronDown
			class="h-4 w-4 shrink-0 text-ink-400 transition {expanded ? 'rotate-180' : ''}"
		/>
	</button>

	{#if expanded}
		<div class="border-t border-ink-900/10 px-5 pb-5 pt-4 space-y-4">
			<div class="flex gap-3">
				<div class="flex-1">
					<label class={labelClass}>Type</label>
					<div class="relative">
						<select
							value={question.type}
							onchange={(e) =>
								handleTypeChange(
									(e.target as HTMLSelectElement).value as QuestionType,
								)}
							class="{fieldClass} appearance-none pr-8"
						>
							{#each Object.keys(QUESTION_TYPE_LABELS) as type}
								<option value={type}
									>{QUESTION_TYPE_LABELS[type as QuestionType]}</option
								>
							{/each}
						</select>
						<ChevronDown
							class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
						/>
					</div>
				</div>
				<div class="w-24">
					<label class={labelClass}>Points</label>
					<input
						type="number"
						min={1}
						value={question.points}
						onchange={(e) =>
							onupdate({
								points: Math.max(1, Number((e.target as HTMLInputElement).value)),
							})}
						class={fieldClass}
					/>
				</div>
			</div>

			<div>
				<div class="mb-1.5 flex items-center justify-between">
					<label class={labelClass}>Question</label>
					<div class="flex gap-1 rounded-md bg-ink-900/5 p-0.5">
						<button
							type="button"
							onclick={() => (promptMode = 'write')}
							class={`rounded px-2 py-0.5 text-[12px] font-medium transition-colors ${
								promptMode === 'write'
									? 'bg-white text-ink-900 shadow-sm'
									: 'text-ink-500 hover:text-ink-700'
							}`}
						>
							Write
						</button>
						<button
							type="button"
							onclick={() => (promptMode = 'preview')}
							class={`rounded px-2 py-0.5 text-[12px] font-medium transition-colors ${
								promptMode === 'preview'
									? 'bg-white text-ink-900 shadow-sm'
									: 'text-ink-500 hover:text-ink-700'
							}`}
						>
							Preview
						</button>
					</div>
				</div>
				{#if promptMode === 'write'}
					<div
						class="mb-1.5 flex items-center gap-1 rounded-md border border-ink-900/12 bg-white p-1"
					>
						<button
							type="button"
							onclick={() => applyFormat('bold')}
							title="Bold"
							class="flex h-7 w-7 items-center justify-center rounded text-ink-500 transition hover:bg-ink-900/5 hover:text-ink-900"
						>
							<Bold class="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							onclick={() => applyFormat('italic')}
							title="Italic"
							class="flex h-7 w-7 items-center justify-center rounded text-ink-500 transition hover:bg-ink-900/5 hover:text-ink-900"
						>
							<Italic class="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							onclick={() => applyFormat('underline')}
							title="Underline"
							class="flex h-7 w-7 items-center justify-center rounded text-ink-500 transition hover:bg-ink-900/5 hover:text-ink-900"
						>
							<Underline class="h-3.5 w-3.5" />
						</button>
					</div>
					<textarea
						bind:this={promptEl}
						value={question.prompt}
						oninput={(e) =>
							onupdate({ prompt: (e.target as HTMLTextAreaElement).value })}
						rows={2}
						class="{fieldClass} resize-none"
						placeholder="Type your question here…"></textarea>
				{:else}
					<div
						class="min-h-[56px] rounded-md border border-ink-900/12 bg-white px-3 py-2"
					>
						{#if question.prompt}
							<Markdown value={question.prompt} />
						{:else}
							<p class="text-[13px] text-ink-300">Nothing to preview yet.</p>
						{/if}
					</div>
				{/if}
			</div>

			<div>
				<label class={labelClass}>Image (optional)</label>
				{#if question.imageUrl}
					<div class="relative overflow-hidden rounded-lg border border-ink-900/10">
						<ImageContainer imageUrl={question.imageUrl} height="h-56" />
						<button
							type="button"
							onclick={removeImage}
							disabled={uploadingImage}
							class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
							title="Remove image"
						>
							<X class="h-4 w-4" />
						</button>
					</div>
				{:else}
					<FileUpload
						label={uploadingImage ? 'Uploading…' : 'Upload image'}
						accept="image/*"
						disabled={uploadingImage}
						onupload={(file) => handleImageUpload(file as File)}
					/>
				{/if}
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
										checked={Array.isArray(question.correctAnswer) &&
											question.correctAnswer.includes(opt.id)}
										onchange={(e) => {
											const arr = Array.isArray(question.correctAnswer)
												? [...question.correctAnswer]
												: [];
											if ((e.target as HTMLInputElement).checked) {
												onupdate({ correctAnswer: [...arr, opt.id] });
											} else {
												onupdate({
													correctAnswer: arr.filter((a) => a !== opt.id),
												});
											}
										}}
										class="h-4 w-4 shrink-0 accent-iris-500"
									/>
								{/if}
								<input
									value={opt.value}
									oninput={(e) =>
										updateOption(i, (e.target as HTMLInputElement).value)}
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
								class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2 text-[14px] font-medium transition {question.correctAnswer ===
								opt.id
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
						oninput={(e) =>
							onupdate({ correctAnswer: (e.target as HTMLInputElement).value })}
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
					oninput={(e) =>
						onupdate({ explanation: (e.target as HTMLTextAreaElement).value })}
					rows={2}
					class="{fieldClass} resize-none"
					placeholder="Explain why the correct answer is right…"></textarea>
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
