import { findMatchingKeyword } from '../services/commentKeywords';

export type CommentAutomationButton = { label: string; url: string };

export type CommentAutomationProps = {
  id: string;
  tenantId: string;
  expertId: string;
  /** Id do Reel (mídia) no Instagram. */
  mediaId: string;
  keywords: string[];
  /** Texto da DM enviada como resposta privada ao comentário. */
  message: string;
  /** Botão de link na DM, opcional. */
  button?: CommentAutomationButton;
  /** Resposta pública ao comentário, publicada depois que a DM sai. */
  commentReply?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Regra de DM automática de um Reel: comentário com a palavra-chave recebe a mensagem. */
export class CommentAutomation {
  constructor(private readonly props: CommentAutomationProps) {}

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get expertId(): string {
    return this.props.expertId;
  }

  get mediaId(): string {
    return this.props.mediaId;
  }

  get keywords(): string[] {
    return this.props.keywords;
  }

  get message(): string {
    return this.props.message;
  }

  get button(): CommentAutomationButton | undefined {
    return this.props.button;
  }

  get commentReply(): string | undefined {
    return this.props.commentReply;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Palavra-chave que dispara a DM para este comentário, se houver. */
  matchingKeyword(comment: string): string | null {
    return this.props.isActive
      ? findMatchingKeyword(comment, this.props.keywords)
      : null;
  }
}
