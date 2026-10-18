/** 文章状态 */
export type PostStatus = 'draft' | 'published';

/** 文章可见性：public=公开，private=私人（仅管理员登录可见） */
export type PostVisibility = 'public' | 'private';

/** 文章摘要（列表用，不含正文） */
export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverKey: string;
  /** 外部封面 URL（图床等），优先级高于 coverKey */
  coverUrl?: string;
  categoryId: string;
  tags: string[];
  status: PostStatus;
  visibility?: PostVisibility;
  author: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  readingTime: number;
  /** 回收站标记：非空表示文章已删除（软删除），前台不可见 */
  deletedAt?: string;
  categoryName?: string;
  views?: number;
  likes?: number;
  commentCount?: number;
}

/** 文章详情（含正文、分类/标签/统计） */
export interface Post extends PostSummary {
  content: string;
  category: { id: string; name: string; slug: string } | null;
  tagDetails: Tag[];
  stats: { views: number; likes: number };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  postCount?: number;
  icon?: string;
  sort?: number;
  posts?: { slug: string; title: string; createdAt: string; publishedAt: string }[];
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  postCount?: number;
  sort?: number;
}

export type CommentStatus = 'pending' | 'approved' | 'rejected';

export interface Comment {
  id: string;
  postId: string;
  postSlug: string;
  postTitle: string;
  author: string;
  email: string;
  website: string;
  content: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MediaMeta {
  uid: string;
  key: string;
  name: string;
  type: 'cover' | 'image' | 'attachment';
  ext: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface SiteConfig {
  title: string;
  subtitle: string;
  description: string;
  keywords: string;
  author: string;
  about: string;
  footerText: string;
  language: string;
  siteUrl: string;
  perPage: number;
  commentEnabled: boolean;
  commentModeration: boolean;
  /** 网站图标 URL（favicon 图片地址；为空使用默认图标） */
  faviconUrl?: string;
  /** 首页精选文章 id 列表（按此顺序展示；空则自动取最新） */
  featuredPostIds?: string[];
  seo: { ogImage?: string; twitterHandle?: string; googleSiteVerification?: string };
  social: { github?: string; twitter?: string; wechat?: string; email?: string };
  backup?: { webdavUrl?: string; webdavUsername?: string; webdavPassword?: string; webdavPath?: string };
  updatedAt: string;
}

export interface VisitStats {
  total: number;
  today: number;
  lastDate: string;
  days: Record<string, number>;
}

/** 近 N 天趋势：单个自然日的访问数据点（无访问的日子由服务端补 0） */
export interface TrendPoint {
  date: string;
  visits: number;
}

/** 趋势汇总：全部由真实访问记录推导，用于图表标注与副指标 */
export interface VisitTrend {
  span: number;
  from: string;
  to: string;
  series: TrendPoint[];
  total: number;
  average: number;
  peak: number;
  peakDate: string;
  activeDays: number;
  recentTotal: number;
  previousTotal: number;
  /** 近半程相对前半程的变化率；前半程为 0 时为 null（无可比基数） */
  changeRatio: number | null;
  /** 7 日移动平均，与 series 等长同序 */
  movingAverage: number[];
}

export interface AdminStats {
  visits: VisitStats;
  trend: VisitTrend;
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalComments: number;
  pendingComments: number;
  totalCategories: number;
  totalTags: number;
  topPosts: Array<{ id: string; slug: string; title: string; status: PostStatus; views: number; likes: number; publishedAt: string }>;
}

export interface Paged<T> {
  ok: boolean;
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  ok: false;
  error: string;
}

/** MCP API Key 公开信息（不含哈希与 token 明文） */
export interface McpKeyInfo {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string;
}
