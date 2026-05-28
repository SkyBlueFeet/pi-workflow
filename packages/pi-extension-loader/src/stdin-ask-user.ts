import { createInterface } from "node:readline";

/** 单个选项的数据结构。 */
interface OptionData {
  label: string;
  description: string;
}

/** 单个问题的数据结构，包含问题文本、标题、选项列表及是否允许多选。 */
interface QuestionData {
  question: string;
  header: string;
  options: OptionData[];
  multiSelect?: boolean;
}

/** stdinAskUser 的入参结构，含问题数组。 */
interface QuestionParams {
  questions: QuestionData[];
}

/**
 * 构建标准工具响应对象。
 *
 * @param text 响应文本内容
 */
function buildToolResult(text: string) {
  return { content: text, isError: false };
}

/**
 * 通过标准输入依次向用户提问并收集回答。
 * 仅在 TTY 模式下可用；非 TTY 模式返回提示信息。
 * 多选问题用逗号分隔序号输入，单选问题输入序号或 'c' 取消。
 *
 * @param params 参数对象，需包含 questions 数组
 * @returns 工具响应，包含格式化后的问答结果
 */
export async function stdinAskUser(params: Record<string, unknown>): Promise<{ content: string; isError: boolean }> {
  const typed = params as unknown as QuestionParams;

  if (!typed.questions?.length) {
    return buildToolResult("Error: no questions provided");
  }

  if (!process.stdin.isTTY) {
    return buildToolResult("User declined to answer questions (non-TTY mode)");
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answers: Array<{ question: string; answer: string | string[] }> = [];

  try {
    for (let i = 0; i < typed.questions.length; i++) {
      const q = typed.questions[i];
      console.log(`\n--- ${q.header ?? "Question"} ${i + 1}/${typed.questions.length} ---`);
      console.log(`${q.question}\n`);

      for (let j = 0; j < q.options.length; j++) {
        console.log(`  ${j + 1}. ${q.options[j].label} — ${q.options[j].description}`);
      }

      if (q.multiSelect) {
        console.log("  (enter comma-separated numbers, or empty to skip)");
        const line = await promptLine(rl, "Choices: ");
        const indices = line
          .split(",")
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !isNaN(n) && n >= 1 && n <= q.options.length)
          .map(n => n - 1);
        const selected = indices.map(i => q.options[i].label);
        answers.push({ question: q.question, answer: selected });
      } else {
        console.log("  (enter number, or 'c' to cancel)");
        const line = await promptLine(rl, "Choice: ");
        const trimmed = line.trim().toLowerCase();
        if (trimmed === "c") {
          answers.push({ question: q.question, answer: "(cancelled)" });
          continue;
        }
        const idx = parseInt(trimmed, 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < q.options.length) {
          answers.push({ question: q.question, answer: q.options[idx].label });
        } else {
          console.log("  (using custom input)");
          answers.push({ question: q.question, answer: trimmed || "(skipped)" });
        }
      }
    }
  } finally {
    rl.close();
  }

  const segments = answers.map(a => {
    const val = Array.isArray(a.answer) ? a.answer.join(", ") : a.answer;
    return `"${a.question}"="${val}"`;
  });
  return buildToolResult(
    `User has answered your questions: ${segments.join(". ")}. You can now continue with the user's answers in mind.`,
  );
}

/**
 * 向 readline 接口写入提示并等待一行用户输入。
 *
 * @param rl readline 接口实例
 * @param prompt 提示文本
 * @returns 用户输入的行内容
 */
function promptLine(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string> {
  return new Promise(resolve => rl.question(prompt, resolve));
}
