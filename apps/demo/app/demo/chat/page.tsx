'use client';

import { useCompletion } from 'ai/react';
import { FormEvent, useRef, useState } from 'react';

type RagSource = {
  itemName: string;
  fieldName: string;
  content: string;
};

type ChatExchange = {
  question: string;
  answer: string;
  sources: RagSource[];
};

export default function ChatDemoPage() {
  const [messages, setMessages] = useState<ChatExchange[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [pendingSources, setPendingSources] = useState<RagSource[]>([]);
  const pendingSourcesRef = useRef<RagSource[]>([]);

  const {
    completion,
    complete,
    isLoading,
    error,
    input,
    setInput,
    handleInputChange,
  } = useCompletion({
    api: '/api/ai/chat',
    onResponse: (response) => {
      const header = response.headers.get('X-Sources');

      if (!header) {
        pendingSourcesRef.current = [];
        setPendingSources([]);
        return;
      }

      try {
        const parsed = JSON.parse(header) as RagSource[];
        pendingSourcesRef.current = parsed;
        setPendingSources(parsed);
      } catch {
        pendingSourcesRef.current = [];
        setPendingSources([]);
      }
    },
    onFinish: (question, answer) => {
      setMessages((current) => [
        ...current,
        { question, answer, sources: pendingSourcesRef.current },
      ]);
      setPendingQuestion(null);
      pendingSourcesRef.current = [];
      setPendingSources([]);
    },
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = input.trim();

    if (!question || isLoading) {
      return;
    }

    setPendingQuestion(question);
    setInput('');
    await complete(question, { body: { question } });
  };

  return (
    <main className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-3xl flex-col px-6 py-6">
      <h1 className="text-2xl font-semibold">RAG Chat</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Ask questions using ingested Sitecore content as context.
      </p>

      <div className="mt-6 flex-1 space-y-4 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {messages.length === 0 && !pendingQuestion ? (
          <p className="text-sm text-zinc-500">Ask a question to start the conversation.</p>
        ) : null}

        {messages.map((message) => (
          <div key={`${message.question}-${message.answer.slice(0, 24)}`} className="space-y-2">
            <div className="rounded-md bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800">
              <span className="font-medium">You: </span>
              {message.question}
            </div>
            <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
              <span className="font-medium">Assistant: </span>
              {message.answer}
            </div>
            {message.sources.length > 0 ? (
              <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                <p className="font-medium text-zinc-700 dark:text-zinc-300">Sources</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {message.sources.map((source) => (
                    <li key={`${source.itemName}-${source.fieldName}`}>
                      {source.itemName} · {source.fieldName}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ))}

        {pendingQuestion ? (
          <div className="space-y-2">
            <div className="rounded-md bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800">
              <span className="font-medium">You: </span>
              {pendingQuestion}
            </div>
            <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
              <span className="font-medium">Assistant: </span>
              {completion || (isLoading ? 'Thinking…' : '')}
            </div>
            {pendingSources.length > 0 && !isLoading ? (
              <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                <p className="font-medium text-zinc-700 dark:text-zinc-300">Sources</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {pendingSources.map((source) => (
                    <li key={`${source.itemName}-${source.fieldName}`}>
                      {source.itemName} · {source.fieldName}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error.message}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask a question…"
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isLoading ? 'Sending…' : 'Send'}
        </button>
      </form>
    </main>
  );
}
