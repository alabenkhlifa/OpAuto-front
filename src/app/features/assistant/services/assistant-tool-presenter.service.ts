import { Injectable, Type } from '@angular/core';
import { TOOL_PRESENTERS } from './tool-presenters';
import {
  AssistantPendingApproval,
  AssistantToolCallStatus,
  AssistantUiMessage,
} from '../../../core/models/assistant.model';

export interface ToolPresenter<TArgs = unknown, TResult = unknown> {
  toolName: string;
  runningKey: string;
  successKey: string;
  failureKey: string;
  runningParams?: (args: TArgs) => Record<string, string | number>;
  successParams?: (args: TArgs, result: TResult) => Record<string, string | number>;
  failureParams?: (args: TArgs, error: string) => Record<string, string | number>;
  previewComponent?: Type<unknown>;
  previewInputs?: (args: TArgs) => Record<string, unknown>;
  approveVerbKey?: string;
}

export interface PresentedTool {
  statusKey: string;
  statusParams: Record<string, string | number>;
  toolName: string;
  state: 'running' | 'success' | 'failure';
  durationMs?: number;
}

export interface ApprovalSummary {
  toolName: string;
  previewComponent?: Type<unknown>;
  previewInputs?: Record<string, unknown>;
  approveVerbKey: string;
}

const FALLBACK_RUNNING = 'assistant.tools._fallback.running';
const FALLBACK_SUCCESS = 'assistant.tools._fallback.success';
const FALLBACK_FAILURE = 'assistant.tools._fallback.failure';
const FALLBACK_APPROVE_VERB = 'assistant.approval.approveDefault';

@Injectable({ providedIn: 'root' })
export class AssistantToolPresenterService {
  private readonly registry = new Map<string, ToolPresenter>(
    TOOL_PRESENTERS.map((p) => [p.toolName, p]),
  );

  format(msg: AssistantUiMessage): PresentedTool | null {
    const tc = msg.toolCall;
    if (!tc) return null;
    // Orphan tool_result bubbles (no toolName) — don't render at all rather
    // than show a useless "That didn't work — " card with an empty pill.
    if (!tc.toolName) return null;
    const preset = this.registry.get(tc.toolName);
    const state = this.toState(tc.status);

    if (!preset) {
      return {
        toolName: tc.toolName,
        state,
        statusKey:
          state === 'success'
            ? FALLBACK_SUCCESS
            : state === 'failure'
              ? FALLBACK_FAILURE
              : FALLBACK_RUNNING,
        statusParams: { name: tc.toolName },
        durationMs: tc.durationMs,
      };
    }

    let statusKey: string;
    let statusParams: Record<string, string | number> = {};

    if (state === 'success') {
      statusKey = preset.successKey;
      try {
        statusParams = preset.successParams?.(tc.args, tc.result) ?? {};
      } catch {
        statusParams = {};
      }
    } else if (state === 'failure') {
      statusKey = preset.failureKey;
      try {
        statusParams =
          preset.failureParams?.(tc.args, tc.errorMessage ?? '') ?? {};
      } catch {
        statusParams = {};
      }
    } else {
      statusKey = preset.runningKey;
      try {
        statusParams = preset.runningParams?.(tc.args) ?? {};
      } catch {
        statusParams = {};
      }
    }

    return {
      toolName: tc.toolName,
      state,
      statusKey,
      statusParams,
      durationMs: tc.durationMs,
    };
  }

  approvalSummary(approval: AssistantPendingApproval): ApprovalSummary {
    const preset = this.registry.get(approval.toolName);
    if (!preset) {
      return {
        toolName: approval.toolName,
        approveVerbKey: FALLBACK_APPROVE_VERB,
      };
    }
    let inputs: Record<string, unknown> | undefined;
    try {
      inputs = preset.previewInputs?.(approval.args);
    } catch {
      inputs = undefined;
    }
    return {
      toolName: approval.toolName,
      previewComponent: preset.previewComponent,
      previewInputs: inputs,
      approveVerbKey: preset.approveVerbKey ?? FALLBACK_APPROVE_VERB,
    };
  }

  hasPresenter(toolName: string): boolean {
    return this.registry.has(toolName);
  }

  allPresenters(): ToolPresenter[] {
    return [...this.registry.values()];
  }

  private toState(status: AssistantToolCallStatus): 'running' | 'success' | 'failure' {
    if (status === 'EXECUTED') return 'success';
    if (status === 'FAILED' || status === 'DENIED' || status === 'EXPIRED') {
      return 'failure';
    }
    return 'running';
  }
}
