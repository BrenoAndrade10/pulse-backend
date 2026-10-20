import type { CommentReplyStatus } from '../enums/CommentReplyStatus';

export type CommentReplyProps = {
  id: string;
  tenantId: string;
  expertId: string;
  automationId: string;
  mediaId: string;
  commentId: string;
  /** Id do autor do comentário no Instagram. O texto do comentário não é guardado. */
  commenterId: string;
  matchedKeyword: string;
  status: CommentReplyStatus;
  errorReason?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** Registro de uma DM automática: garante uma única resposta por comentário. */
export class CommentReply {
  constructor(private readonly props: CommentReplyProps) {}

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get expertId(): string {
    return this.props.expertId;
  }

  get automationId(): string {
    return this.props.automationId;
  }

  get mediaId(): string {
    return this.props.mediaId;
  }

  get commentId(): string {
    return this.props.commentId;
  }

  get commenterId(): string {
    return this.props.commenterId;
  }

  get matchedKeyword(): string {
    return this.props.matchedKeyword;
  }

  get status(): CommentReplyStatus {
    return this.props.status;
  }

  get errorReason(): string | undefined {
    return this.props.errorReason;
  }

  get sentAt(): Date | undefined {
    return this.props.sentAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
