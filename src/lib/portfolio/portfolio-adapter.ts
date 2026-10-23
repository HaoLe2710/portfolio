import type {
  Achievement,
  BlogPost,
  Certificate,
  ContactLink,
  Locale,
  LocalizedAchievement,
  LocalizedBlogPost,
  LocalizedCertificate,
  LocalizedContactLink,
  LocalizedProject,
  LocalizedProjectContentBlock,
  LocalizedProjectLink,
  LocalizedProfile,
  LocalizedSiteSettings,
  LocalizedSkillGroup,
  LocalizedText,
  Profile,
  Project,
  ProjectContentBlock,
  ProjectLink,
  SiteSettings,
  SkillGroup,
} from "@/types/portfolio";

const FALLBACK_LOCALE: Locale = "en";

function localize<T>(value: LocalizedText<T>, locale: Locale): T {
  return value[locale] ?? value[FALLBACK_LOCALE];
}

export function localizeProfile(
  profile: Profile,
  locale: Locale
): LocalizedProfile {
  return {
    ...profile,
    locale,
    role: localize(profile.role, locale),
    location: localize(profile.location, locale),
    university: localize(profile.university, locale),
    major: localize(profile.major, locale),
    focus: localize(profile.focus, locale),
    summary: localize(profile.summary, locale),
    about: localize(profile.about, locale),
    careerObjective: localize(profile.careerObjective, locale),
  };
}

export function localizeSkillGroup(
  skillGroup: SkillGroup,
  locale: Locale
): LocalizedSkillGroup {
  return {
    ...skillGroup,
    locale,
    name: localize(skillGroup.name, locale),
    skills: skillGroup.skills.map((skill) => ({ ...skill })),
  };
}

export function localizeProjectLink(
  projectLink: ProjectLink,
  locale: Locale
): LocalizedProjectLink {
  return {
    ...projectLink,
    label: localize(projectLink.label, locale),
  };
}

export function localizeContentBlock(
  block: ProjectContentBlock,
  locale: Locale
): LocalizedProjectContentBlock {
  switch (block.type) {
    case "MARKDOWN":
      return {
        id: block.id,
        type: block.type,
        title: localize(block.title, locale),
        body: localize(block.body, locale),
      };
    case "FEATURE_GRID":
      return {
        id: block.id,
        type: block.type,
        title: localize(block.title, locale),
        items: block.items.map((item) => ({
          ...item,
          title: localize(item.title, locale),
          description: localize(item.description, locale),
        })),
      };
    case "ARCHITECTURE_FLOW":
      return {
        id: block.id,
        type: block.type,
        title: localize(block.title, locale),
        steps: block.steps.map((step) => ({
          ...step,
          label: localize(step.label, locale),
        })),
      };
    case "MODULE_LIST":
      return {
        id: block.id,
        type: block.type,
        title: localize(block.title, locale),
        items: block.items.map((item) => ({
          ...item,
          title: localize(item.title, locale),
          description: localize(item.description, locale),
        })),
      };
    case "CI_CD_FLOW":
      return {
        id: block.id,
        type: block.type,
        title: localize(block.title, locale),
        steps: block.steps.map((step) => ({
          id: step.id,
          label: localize(step.label, locale),
          description: step.description
            ? localize(step.description, locale)
            : undefined,
        })),
      };
    case "IMAGE_GALLERY":
      return {
        id: block.id,
        type: block.type,
        title: localize(block.title, locale),
        images: block.images.map((image) => ({
          id: image.id,
          src: image.src,
          alt: localize(image.alt, locale),
          caption: image.caption ? localize(image.caption, locale) : undefined,
        })),
      };
    case "METRIC_CARDS":
      return {
        id: block.id,
        type: block.type,
        title: localize(block.title, locale),
        metrics: block.metrics.map((metric) => ({
          id: metric.id,
          label: localize(metric.label, locale),
          value: metric.value,
          description: metric.description
            ? localize(metric.description, locale)
            : undefined,
        })),
      };
    case "LINK_GROUP":
      return {
        id: block.id,
        type: block.type,
        title: localize(block.title, locale),
        links: block.links.map((link) => localizeProjectLink(link, locale)),
      };
  }
}

export function localizeProject(
  project: Project,
  locale: Locale
): LocalizedProject {
  return {
    ...project,
    locale,
    title: localize(project.title, locale),
    subtitle: localize(project.subtitle, locale),
    role: localize(project.role, locale),
    description: localize(project.description, locale),
    statusLabels: localize(project.statusLabels, locale),
    highlights: localize(project.highlights, locale),
    links: project.links.map((link) => localizeProjectLink(link, locale)),
    contentBlocks: project.contentBlocks.map((block) =>
      localizeContentBlock(block, locale)
    ),
  };
}

export function localizeAchievement(
  achievement: Achievement,
  locale: Locale
): LocalizedAchievement {
  return {
    ...achievement,
    locale,
    title: localize(achievement.title, locale),
    description: localize(achievement.description, locale),
  };
}

export function localizeCertificate(
  certificate: Certificate,
  locale: Locale
): LocalizedCertificate {
  return {
    ...certificate,
    locale,
    title: localize(certificate.title, locale),
    issuer: localize(certificate.issuer, locale),
    description: localize(certificate.description, locale),
  };
}

export function localizeBlogPost(
  blogPost: BlogPost,
  locale: Locale
): LocalizedBlogPost {
  return {
    ...blogPost,
    locale,
    title: localize(blogPost.title, locale),
    summary: localize(blogPost.summary, locale),
    content: localize(blogPost.content, locale),
  };
}

export function localizeContactLink(
  contactLink: ContactLink,
  locale: Locale
): LocalizedContactLink {
  return {
    ...contactLink,
    locale,
    label: localize(contactLink.label, locale),
  };
}

export function localizeSiteSettings(
  siteSettings: SiteSettings,
  locale: Locale
): LocalizedSiteSettings {
  return {
    ...siteSettings,
    supportedLocales: [...siteSettings.supportedLocales],
    locale,
  };
}
