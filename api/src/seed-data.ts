import { mockPortfolio } from "../../src/data/mock-portfolio";
import type {
  Achievement,
  BlogPost,
  Certificate,
  ContactLink,
  Locale,
  Project,
  ProjectContentBlock,
  SkillGroup,
} from "../../src/types/portfolio";

const SEED_NAME = "initial-mock-v1";
const LOCALES: Locale[] = ["en", "vi"];

type SqlPrimitive = string | number | boolean | null | undefined;
type InsertRow = Record<string, SqlPrimitive>;
function sqlValue(value: SqlPrimitive): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Seed data contains a non-finite number.");
    return String(value);
  }
  return `'${value.replaceAll("'", "''")}'`;
}

function insert(table: string, row: InsertRow) {
  const columns = Object.keys(row);
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns
    .map((column) => sqlValue(row[column]))
    .join(", ")}) ON CONFLICT DO NOTHING;`;
}

function localized<T>(value: Record<Locale, T>, locale: Locale) {
  return value[locale];
}

function validateParallelTranslations<T>(
  entity: string,
  english: T[],
  vietnamese: T[]
) {
  if (english.length !== vietnamese.length) {
    throw new Error(`${entity} EN/VI item counts differ (${english.length}/${vietnamese.length}).`);
  }
}

function contentBlockMetadata(block: ProjectContentBlock): Record<string, unknown> {
  switch (block.type) {
    case "MARKDOWN":
      return {};
    case "FEATURE_GRID":
    case "MODULE_LIST":
      return { items: block.items };
    case "ARCHITECTURE_FLOW":
      return { nodes: block.steps };
    case "CI_CD_FLOW":
      return { steps: block.steps };
    case "IMAGE_GALLERY":
      return { images: block.images };
    case "METRIC_CARDS":
      return { metrics: block.metrics };
    case "LINK_GROUP":
      return { links: block.links };
  }
}

function seedProfile(lines: string[]) {
  const profile = mockPortfolio.profile;
  lines.push(
    insert("profile", {
      id: "primary",
      full_name: profile.fullName,
      brand: profile.brand,
      gpa: profile.gpa,
      email: profile.email,
      github_url: profile.githubUrl,
      linkedin_url: profile.linkedInUrl,
      cv_url: profile.cvUrl,
      status: "PUBLISHED",
    })
  );

  for (const locale of LOCALES) {
    lines.push(
      insert("profile_translations", {
        profile_id: "primary",
        locale,
        role: localized(profile.role, locale),
        location: localized(profile.location, locale),
        university: localized(profile.university, locale),
        major: localized(profile.major, locale),
        focus: localized(profile.focus, locale),
        summary: localized(profile.summary, locale),
        about: localized(profile.about, locale),
        career_objective: localized(profile.careerObjective, locale),
      })
    );
  }
}

function seedSkillGroups(lines: string[]) {
  mockPortfolio.skillGroups.forEach((group: SkillGroup, groupOrder: number) => {
    lines.push(
      insert("skill_groups", {
        id: group.id,
        icon: group.icon,
        display_order: groupOrder,
        status: "PUBLISHED",
      })
    );

    for (const locale of LOCALES) {
      lines.push(
        insert("skill_group_translations", {
          skill_group_id: group.id,
          locale,
          name: localized(group.name, locale),
          description: null,
        })
      );
    }

    group.skills.forEach((skill, skillOrder) => {
      lines.push(
        insert("skills", {
          id: skill.id,
          skill_group_id: group.id,
          icon: null,
          level: null,
          display_order: skillOrder,
          status: "PUBLISHED",
        }),
        insert("skill_translations", {
          skill_id: skill.id,
          locale: "en",
          name: skill.name,
        }),
        insert("skill_translations", {
          skill_id: skill.id,
          locale: "vi",
          name: skill.name,
        })
      );
    });
  });
}

function seedProject(lines: string[], project: Project, projectOrder: number) {
  lines.push(
    insert("projects", {
      id: project.id,
      slug: project.slug,
      featured: project.featured,
      thumbnail_url: null,
      display_order: projectOrder,
      status: "PUBLISHED",
    })
  );

  for (const locale of LOCALES) {
    lines.push(
      insert("project_translations", {
        project_id: project.id,
        locale,
        title: localized(project.title, locale),
        subtitle: localized(project.subtitle, locale),
        role: localized(project.role, locale),
        summary: localized(project.description, locale),
        description: localized(project.description, locale),
      })
    );
  }

  validateParallelTranslations(
    `project ${project.id} status labels`,
    project.statusLabels.en,
    project.statusLabels.vi
  );
  project.statusLabels.en.forEach((label, index) => {
    const id = `${project.id}-status-${index + 1}`;
    lines.push(
      insert("project_status_labels", {
        id,
        project_id: project.id,
        tone: null,
        icon: null,
        display_order: index,
        status: "PUBLISHED",
      }),
      insert("project_status_label_translations", {
        status_label_id: id,
        locale: "en",
        label,
      }),
      insert("project_status_label_translations", {
        status_label_id: id,
        locale: "vi",
        label: project.statusLabels.vi[index],
      })
    );
  });

  project.techStack.forEach((technology, index) => {
    lines.push(
      insert("project_tech_stack", {
        project_id: project.id,
        technology,
        display_order: index,
      })
    );
  });

  validateParallelTranslations(
    `project ${project.id} highlights`,
    project.highlights.en,
    project.highlights.vi
  );
  project.highlights.en.forEach((text, index) => {
    const id = `${project.id}-highlight-${index + 1}`;
    lines.push(
      insert("project_highlights", {
        id,
        project_id: project.id,
        display_order: index,
        status: "PUBLISHED",
      }),
      insert("project_highlight_translations", {
        highlight_id: id,
        locale: "en",
        text,
      }),
      insert("project_highlight_translations", {
        highlight_id: id,
        locale: "vi",
        text: project.highlights.vi[index],
      })
    );
  });

  project.links.forEach((link, index) => {
    lines.push(
      insert("project_links", {
        id: link.id,
        project_id: project.id,
        href: link.href,
        icon: link.icon,
        link_type: "repository",
        is_primary: index === 0,
        display_order: index,
        status: "PUBLISHED",
      })
    );
    for (const locale of LOCALES) {
      lines.push(
        insert("project_link_translations", {
          project_link_id: link.id,
          locale,
          label: localized(link.label, locale),
        })
      );
    }
  });

  project.contentBlocks.forEach((block, index) => {
    lines.push(
      insert("project_content_blocks", {
        id: block.id,
        project_id: project.id,
        type: block.type,
        display_order: index,
        metadata_json: JSON.stringify(contentBlockMetadata(block)),
        status: "PUBLISHED",
      })
    );

    for (const locale of LOCALES) {
      lines.push(
        insert("project_content_block_translations", {
          content_block_id: block.id,
          locale,
          title: localized(block.title, locale),
          markdown: block.type === "MARKDOWN" ? localized(block.body, locale) : null,
          description: null,
        })
      );
    }
  });
}

function seedAchievements(lines: string[]) {
  mockPortfolio.achievements.forEach((achievement: Achievement, index: number) => {
    lines.push(
      insert("achievements", {
        id: achievement.id,
        icon: achievement.icon,
        issuer: null,
        achieved_at: null,
        display_order: index,
        status: "PUBLISHED",
      })
    );
    for (const locale of LOCALES) {
      lines.push(
        insert("achievement_translations", {
          achievement_id: achievement.id,
          locale,
          title: localized(achievement.title, locale),
          description: localized(achievement.description, locale),
        })
      );
    }
  });
}

function seedCertificates(lines: string[]) {
  mockPortfolio.certificates.forEach((certificate: Certificate, index: number) => {
    lines.push(
      insert("certificates", {
        id: certificate.id,
        icon: certificate.icon,
        kind: certificate.kind,
        official: certificate.official,
        credential_url: null,
        issued_at: null,
        display_order: index,
        status: "PUBLISHED",
      })
    );
    for (const locale of LOCALES) {
      lines.push(
        insert("certificate_translations", {
          certificate_id: certificate.id,
          locale,
          title: localized(certificate.title, locale),
          issuer: localized(certificate.issuer, locale),
          description: localized(certificate.description, locale),
        })
      );
    }
  });
}

function seedBlogPosts(lines: string[]) {
  mockPortfolio.blogPosts.forEach((post: BlogPost, index: number) => {
    lines.push(
      insert("blog_posts", {
        id: post.id,
        slug: post.slug,
        featured: post.featured,
        published_at: post.publishedAt,
        reading_time_minutes: post.readingTimeMinutes,
        cover_image_url: null,
        display_order: index,
        status: "PUBLISHED",
      })
    );

    for (const locale of LOCALES) {
      lines.push(
        insert("blog_post_translations", {
          blog_post_id: post.id,
          locale,
          title: localized(post.title, locale),
          summary: localized(post.summary, locale),
          content_markdown: localized(post.content, locale),
          seo_title: null,
          seo_description: null,
          canonical_path: null,
          og_image_url: null,
        })
      );
    }

    post.tags.forEach((tag, tagOrder) => {
      lines.push(
        insert("blog_post_tags", {
          blog_post_id: post.id,
          tag,
          display_order: tagOrder,
        })
      );
    });
  });
}

function seedContactLinks(lines: string[]) {
  mockPortfolio.contactLinks.forEach((link: ContactLink, index: number) => {
    lines.push(
      insert("contact_links", {
        id: link.id,
        type: link.type,
        icon: link.icon,
        href: link.href,
        value: link.value,
        is_primary: index === 0,
        display_order: index,
        status: "PUBLISHED",
      })
    );
    for (const locale of LOCALES) {
      lines.push(
        insert("contact_link_translations", {
          contact_link_id: link.id,
          locale,
          label: localized(link.label, locale),
        })
      );
    }
  });
}

function seedSiteSettings(lines: string[]) {
  const settings = mockPortfolio.siteSettings;
  lines.push(
    insert("site_settings", {
      id: "primary",
      default_locale: settings.defaultLocale,
      supported_locales_json: JSON.stringify(settings.supportedLocales),
      default_og_image_url: null,
      github_url: mockPortfolio.profile.githubUrl,
      linked_in_url: mockPortfolio.profile.linkedInUrl,
      email: mockPortfolio.profile.email,
      cv_url: mockPortfolio.profile.cvUrl,
      status: "PUBLISHED",
    })
  );
  for (const locale of LOCALES) {
    lines.push(
      insert("site_settings_translations", {
        site_settings_id: "primary",
        locale,
        site_name: settings.siteName,
        author_name: settings.authorName,
        default_title: null,
        default_description: null,
        title_template: null,
      })
    );
  }
}

export function buildSeedSql(sourceHash: string) {
  const lines: string[] = [];
  seedProfile(lines);
  seedSkillGroups(lines);
  mockPortfolio.projects.forEach((project: Project, index: number) =>
    seedProject(lines, project, index)
  );
  seedAchievements(lines);
  seedCertificates(lines);
  seedBlogPosts(lines);
  seedContactLinks(lines);
  seedSiteSettings(lines);

  const importedCounts = {
    profile: 1,
    skillGroups: mockPortfolio.skillGroups.length,
    skills: mockPortfolio.skillGroups.reduce((total, group) => total + group.skills.length, 0),
    projects: mockPortfolio.projects.length,
    projectStatusLabels: mockPortfolio.projects.reduce(
      (total, project) => total + project.statusLabels.en.length,
      0
    ),
    projectTechStack: mockPortfolio.projects.reduce(
      (total, project) => total + project.techStack.length,
      0
    ),
    projectHighlights: mockPortfolio.projects.reduce(
      (total, project) => total + project.highlights.en.length,
      0
    ),
    projectLinks: mockPortfolio.projects.reduce(
      (total, project) => total + project.links.length,
      0
    ),
    projectContentBlocks: mockPortfolio.projects.reduce(
      (total, project) => total + project.contentBlocks.length,
      0
    ),
    achievements: mockPortfolio.achievements.length,
    certificates: mockPortfolio.certificates.length,
    blogPosts: mockPortfolio.blogPosts.length,
    blogTags: mockPortfolio.blogPosts.reduce((total, post) => total + post.tags.length, 0),
    contactLinks: mockPortfolio.contactLinks.length,
    siteSettings: 1,
  };

  lines.push(
    insert("seed_runs", {
      id: `${SEED_NAME}:${sourceHash}`,
      seed_name: SEED_NAME,
      source_hash: sourceHash,
      imported_rows_json: JSON.stringify(importedCounts),
    })
  );

  return { sql: lines.join("\n"), statements: lines, importedCounts };
}
