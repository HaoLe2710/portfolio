import type {
  Achievement,
  BlogPost,
  Certificate,
  ContactLink,
  Profile,
  Project,
  SiteSettings,
  SkillGroup,
} from "@/types/portfolio";

export const profile: Profile = {
  fullName: "Le Ngoc Hao",
  brand: "Hao.dev",
  role: {
    en: "Java Backend Developer Intern / Fresher",
    vi: "Java Backend Developer Intern / Fresher",
  },
  location: {
    en: "Ho Chi Minh City, Vietnam",
    vi: "Thành phố Hồ Chí Minh, Việt Nam",
  },
  university: {
    en: "Industrial University of Ho Chi Minh City",
    vi: "Trường Đại học Công nghiệp Thành phố Hồ Chí Minh",
  },
  major: {
    en: "Software Engineering",
    vi: "Kỹ thuật phần mềm",
  },
  gpa: "3.54 / 4.00",
  focus: {
    en: "Java Backend Development",
    vi: "Phát triển Backend với Java",
  },
  email: "lengochao123.27102004@gmail.com",
  githubUrl: "https://github.com/HaoLe2710",
  linkedInUrl: "",
  cvUrl: "/cv/le-ngoc-hao-cv.pdf",
  summary: {
    en: "Software Engineering student focused on Java Backend Development, with experience in Spring Boot REST APIs, microservices, databases, Docker, and basic CI/CD. Able to collaborate across web/mobile teams and quickly learn new technologies.",
    vi: "Sinh viên ngành Kỹ thuật phần mềm định hướng Java Backend Development, có kinh nghiệm xây dựng REST APIs với Spring Boot, microservices, cơ sở dữ liệu, Docker và CI/CD cơ bản. Có khả năng phối hợp với đội web/mobile và nhanh chóng học công nghệ mới.",
  },
  about: {
    en: "I am a Software Engineering student at Industrial University of Ho Chi Minh City, focusing on Java Backend Development. I am interested in backend architecture, API design, databases, cloud deployment, and building practical software systems.",
    vi: "Tôi là sinh viên ngành Kỹ thuật phần mềm tại Trường Đại học Công nghiệp Thành phố Hồ Chí Minh, định hướng phát triển Backend với Java. Tôi quan tâm đến kiến trúc backend, thiết kế API, cơ sở dữ liệu, triển khai cloud và xây dựng các hệ thống phần mềm có tính ứng dụng thực tế.",
  },
  careerObjective: {
    en: "Seeking a Java Backend Developer Intern/Fresher position to apply my knowledge of Java, Spring Boot, RESTful APIs, and databases, while continuously learning and growing as a Backend Developer.",
    vi: "Mong muốn ứng tuyển vị trí Java Backend Developer Intern/Fresher để áp dụng kiến thức về Java, Spring Boot, RESTful APIs và cơ sở dữ liệu, đồng thời tiếp tục học hỏi và phát triển theo định hướng Backend Developer.",
  },
};

export const skillGroups: SkillGroup[] = [
  {
    id: "backend",
    icon: "dns",
    name: {
      en: "Backend",
      vi: "Backend",
    },
    skills: [
      "Java",
      "Spring Boot",
      "Spring Security",
      "RESTful API",
      "JWT",
      "Microservices",
    ].map((name) => ({ id: name.toLowerCase().replaceAll(" ", "-"), name })),
  },
  {
    id: "database-cache",
    icon: "database",
    name: {
      en: "Database & Cache",
      vi: "Cơ sở dữ liệu & Cache",
    },
    skills: ["PostgreSQL", "MongoDB", "Redis"].map((name) => ({
      id: name.toLowerCase().replaceAll(" ", "-"),
      name,
    })),
  },
  {
    id: "devops-cloud",
    icon: "cloud_upload",
    name: {
      en: "DevOps & Cloud",
      vi: "DevOps & Cloud",
    },
    skills: [
      "Docker",
      "Docker Compose",
      "Docker Hub",
      "GitHub Actions",
      "AWS EC2",
      "AWS S3",
    ].map((name) => ({ id: name.toLowerCase().replaceAll(" ", "-"), name })),
  },
  {
    id: "frontend-mobile",
    icon: "devices",
    name: {
      en: "Frontend / Mobile",
      vi: "Frontend / Mobile",
    },
    skills: [
      "JavaScript",
      "TypeScript",
      "ReactJS",
      "Next.js",
      "React Native",
      "HTML",
      "CSS",
      "Tailwind CSS",
    ].map((name) => ({ id: name.toLowerCase().replaceAll(" ", "-"), name })),
  },
  {
    id: "messaging-iot",
    icon: "sensors",
    name: {
      en: "Messaging / IoT",
      vi: "Messaging / IoT",
    },
    skills: [
      "MQTT",
      "Kafka basic",
      "ESP32 basic",
      "IoT telemetry",
      "Sensor data processing",
    ].map((name) => ({ id: name.toLowerCase().replaceAll(" ", "-"), name })),
  },
  {
    id: "tools",
    icon: "construction",
    name: {
      en: "Tools",
      vi: "Công cụ",
    },
    skills: ["Git", "GitHub", "Postman", "Maven", "IntelliJ IDEA", "VS Code"].map(
      (name) => ({ id: name.toLowerCase().replaceAll(" ", "-"), name })
    ),
  },
];

export const projects: Project[] = [
  {
    id: "leafy",
    slug: "leafy-aiot-smart-agriculture-platform",
    featured: true,
    title: {
      en: "Leafy – AIoT Smart Agriculture Platform",
      vi: "Leafy – Nền tảng nông nghiệp thông minh AIoT",
    },
    subtitle: {
      en: "AIoT monitoring and AI-based leaf disease diagnosis.",
      vi: "Giám sát AIoT và chẩn đoán bệnh lá bằng AI.",
    },
    role: {
      en: "Backend / IoT / Web & Mobile Contributor",
      vi: "Thành viên phát triển Backend / IoT / Web & Mobile",
    },
    description: {
      en: "A smart agriculture platform combining IoT monitoring, AI-based leaf disease diagnosis, alerting, notifications, and advisory features.",
      vi: "Nền tảng nông nghiệp thông minh kết hợp giám sát IoT, chẩn đoán bệnh lá bằng AI, cảnh báo, thông báo và hỗ trợ tư vấn chăm sóc cây trồng.",
    },
    statusLabels: {
      en: ["Graduation Thesis", "Backend", "IoT", "Alerting"],
      vi: ["Khóa luận tốt nghiệp", "Backend", "IoT", "Cảnh báo"],
    },
    techStack: [
      "Java",
      "Spring Boot",
      "Microservices",
      "MongoDB",
      "PostgreSQL",
      "Redis",
      "Kafka",
      "MQTT",
      "ReactJS",
      "React Native",
      "ESP32",
    ],
    highlights: {
      en: [
        "Developed backend services for IoT telemetry, farm management, disease diagnosis, notifications, and file storage.",
        "Designed REST APIs, service communication, and data models across core system modules.",
        "Integrated ESP32 sensor data and alert workflows from thresholds to dashboards and notifications.",
        "Added alert events to farmer event history and supported monitoring on web/mobile interfaces.",
      ],
      vi: [
        "Phát triển các backend service cho dữ liệu IoT, quản lý nông trại, chẩn đoán bệnh, thông báo và lưu trữ tệp.",
        "Thiết kế REST APIs, giao tiếp giữa service và mô hình dữ liệu cho các module lõi của hệ thống.",
        "Tích hợp dữ liệu cảm biến ESP32 và luồng cảnh báo từ ngưỡng đo đến dashboard và thông báo.",
        "Bổ sung sự kiện cảnh báo vào lịch sử hoạt động của nông dân và hỗ trợ theo dõi trên web/mobile.",
      ],
    },
    links: [
      {
        id: "leafy-backend",
        label: { en: "Backend Repo", vi: "Backend Repo" },
        href: "https://github.com/kltnhoanghao2026/Leafy_BE",
        icon: "open_in_new",
      },
      {
        id: "leafy-frontend",
        label: { en: "Frontend Repo", vi: "Frontend Repo" },
        href: "https://github.com/kltnhoanghao2026/Leafy_FE",
        icon: "open_in_new",
      },
      {
        id: "leafy-mobile",
        label: { en: "Mobile Repo", vi: "Mobile Repo" },
        href: "https://github.com/kltnhoanghao2026/Leafy_APP",
        icon: "open_in_new",
      },
      {
        id: "leafy-iot",
        label: { en: "IoT Repo", vi: "IoT Repo" },
        href: "https://github.com/HaoLe2710/Leafy_IoT",
        icon: "open_in_new",
      },
    ],
    contentBlocks: [
      {
        id: "leafy-overview",
        type: "MARKDOWN",
        title: { en: "Project overview", vi: "Tổng quan dự án" },
        body: {
          en: "Leafy is a graduation thesis project for smart agriculture. The platform connects IoT telemetry, backend services, web/mobile dashboards, AI-assisted disease diagnosis, and notification workflows into one practical farm monitoring system.",
          vi: "Leafy là đề tài khóa luận tốt nghiệp về nông nghiệp thông minh. Nền tảng kết nối dữ liệu IoT, backend services, dashboard web/mobile, chẩn đoán bệnh bằng AI và luồng thông báo thành một hệ thống giám sát nông trại thực tế.",
        },
      },
      {
        id: "leafy-features",
        type: "FEATURE_GRID",
        title: { en: "Main features I worked on", vi: "Các tính năng chính tôi tham gia" },
        items: [
          {
            id: "iot-telemetry",
            icon: "sensors",
            title: { en: "IoT telemetry", vi: "Dữ liệu IoT" },
            description: {
              en: "Sensor data ingestion, monitoring APIs, and threshold-based alert preparation.",
              vi: "Tiếp nhận dữ liệu cảm biến, API giám sát và chuẩn bị cảnh báo theo ngưỡng.",
            },
          },
          {
            id: "farm-management",
            icon: "grass",
            title: { en: "Farm management", vi: "Quản lý nông trại" },
            description: {
              en: "Backend models and endpoints for farm, crop, and user-facing monitoring data.",
              vi: "Mô hình dữ liệu và endpoint backend cho nông trại, cây trồng và dữ liệu theo dõi.",
            },
          },
          {
            id: "notifications",
            icon: "notifications",
            title: { en: "Notifications", vi: "Thông báo" },
            description: {
              en: "Alert history and notification support for farmer web/mobile experiences.",
              vi: "Lịch sử cảnh báo và hỗ trợ thông báo cho trải nghiệm web/mobile của nông dân.",
            },
          },
        ],
      },
      {
        id: "leafy-architecture",
        type: "ARCHITECTURE_FLOW",
        title: { en: "System architecture", vi: "Kiến trúc hệ thống" },
        steps: [
          { id: "esp32", icon: "memory", label: { en: "ESP32 Device", vi: "Thiết bị ESP32" } },
          { id: "mqtt-http", icon: "sync_alt", label: { en: "MQTT / HTTP", vi: "MQTT / HTTP" } },
          { id: "backend", icon: "dns", label: { en: "Backend Services", vi: "Backend Services" } },
          { id: "database", icon: "database", label: { en: "Database / Cache", vi: "Database / Cache" } },
          { id: "dashboard", icon: "dashboard", label: { en: "Web & Mobile Dashboard", vi: "Dashboard Web & Mobile" } },
          { id: "notification", icon: "notifications", label: { en: "Notification", vi: "Thông báo" } },
        ],
      },
      {
        id: "leafy-modules",
        type: "MODULE_LIST",
        title: { en: "IoT and alert modules", vi: "Module IoT và cảnh báo" },
        items: [
          {
            id: "telemetry-engine",
            icon: "router",
            title: { en: "Telemetry engine", vi: "Telemetry engine" },
            description: {
              en: "Receives and structures environmental readings from ESP32 devices.",
              vi: "Tiếp nhận và cấu trúc dữ liệu môi trường từ thiết bị ESP32.",
            },
          },
          {
            id: "alert-workflow",
            icon: "warning",
            title: { en: "Alert workflow", vi: "Luồng cảnh báo" },
            description: {
              en: "Maps sensor thresholds to alert events, activity history, and user notifications.",
              vi: "Ánh xạ ngưỡng cảm biến thành sự kiện cảnh báo, lịch sử hoạt động và thông báo người dùng.",
            },
          },
        ],
      },
      {
        id: "leafy-metrics",
        type: "METRIC_CARDS",
        title: { en: "Thesis and project metrics", vi: "Chỉ số khóa luận và dự án" },
        metrics: [
          { id: "score", label: { en: "Thesis Score", vi: "Điểm khóa luận" }, value: "10/10" },
          { id: "award", label: { en: "Award", vi: "Giải thưởng" }, value: "Promising Award" },
          { id: "runtime", label: { en: "Runtime", vi: "Nền tảng chạy" }, value: "Web + Mobile + IoT" },
        ],
      },
      {
        id: "leafy-links",
        type: "LINK_GROUP",
        title: { en: "Repository links", vi: "Liên kết repository" },
        links: [],
      },
    ],
  },
  {
    id: "ecommerce",
    slug: "cosmetics-ecommerce-system",
    featured: true,
    title: {
      en: "Cosmetics E-commerce System",
      vi: "Hệ thống thương mại điện tử mỹ phẩm",
    },
    subtitle: {
      en: "Clean Architecture & Modular Monolithic Backend.",
      vi: "Backend theo Clean Architecture và Modular Monolithic.",
    },
    role: {
      en: "Backend Developer | Deployment & CI/CD",
      vi: "Backend Developer | Triển khai & CI/CD",
    },
    description: {
      en: "An e-commerce system built with Java Spring Boot, Clean Architecture, Modular Monolithic design, and Docker-based deployment.",
      vi: "Hệ thống thương mại điện tử được xây dựng với Java Spring Boot, Clean Architecture, Modular Monolithic và triển khai bằng Docker.",
    },
    statusLabels: {
      en: ["Backend", "Clean Architecture", "CI/CD", "Cloud"],
      vi: ["Backend", "Clean Architecture", "CI/CD", "Cloud"],
    },
    techStack: [
      "Java",
      "Spring Boot",
      "PostgreSQL",
      "Redis",
      "Docker",
      "GitHub Actions",
      "AWS EC2",
      "AWS S3",
      "ReactJS",
    ],
    highlights: {
      en: [
        "Designed backend architecture using Clean Architecture and Modular Monolithic principles.",
        "Implemented cart, order, product data management, and product search optimization.",
        "Set up Docker-based deployment and CI/CD workflow using GitHub Actions, Docker Hub, and AWS.",
        "Prepared backend services for integration with client and admin web applications.",
      ],
      vi: [
        "Thiết kế kiến trúc backend theo Clean Architecture và Modular Monolithic.",
        "Triển khai các module giỏ hàng, đơn hàng, quản lý dữ liệu sản phẩm và tối ưu tìm kiếm sản phẩm.",
        "Thiết lập quy trình triển khai bằng Docker và CI/CD với GitHub Actions, Docker Hub và AWS.",
        "Chuẩn bị backend service để tích hợp với ứng dụng web phía người dùng và trang quản trị.",
      ],
    },
    links: [
      {
        id: "ecommerce-backend",
        label: { en: "Backend Repo", vi: "Backend Repo" },
        href: "https://github.com/HaoLe2710/KTTKPM_Nhom15_BE",
        icon: "open_in_new",
      },
      {
        id: "ecommerce-admin",
        label: { en: "Admin UI", vi: "Admin UI" },
        href: "https://github.com/HaoLe2710/KTTKPM_Nhom15_Admin",
        icon: "open_in_new",
      },
      {
        id: "ecommerce-client",
        label: { en: "Client UI", vi: "Client UI" },
        href: "https://github.com/minhkhoagithub/UI_Web_Cosmetics_Ecommerce",
        icon: "open_in_new",
      },
    ],
    contentBlocks: [
      {
        id: "ecommerce-overview",
        type: "MARKDOWN",
        title: { en: "Project overview", vi: "Tổng quan dự án" },
        body: {
          en: "The cosmetics e-commerce system focuses on backend structure, maintainable module boundaries, product data workflows, cart and order flows, and deployment readiness for cloud environments.",
          vi: "Hệ thống thương mại điện tử mỹ phẩm tập trung vào cấu trúc backend, ranh giới module dễ bảo trì, luồng dữ liệu sản phẩm, giỏ hàng, đơn hàng và khả năng triển khai lên môi trường cloud.",
        },
      },
      {
        id: "ecommerce-architecture",
        type: "ARCHITECTURE_FLOW",
        title: { en: "System architecture", vi: "Kiến trúc hệ thống" },
        steps: [
          { id: "client-admin", icon: "devices", label: { en: "Client / Admin UI", vi: "Client / Admin UI" } },
          { id: "rest-api", icon: "api", label: { en: "REST API", vi: "REST API" } },
          { id: "application", icon: "layers", label: { en: "Application Layer", vi: "Application Layer" } },
          { id: "domain", icon: "hub", label: { en: "Domain Layer", vi: "Domain Layer" } },
          { id: "infrastructure", icon: "storage", label: { en: "Infrastructure Layer", vi: "Infrastructure Layer" } },
          { id: "data-cloud", icon: "cloud", label: { en: "PostgreSQL / Redis / AWS", vi: "PostgreSQL / Redis / AWS" } },
        ],
      },
      {
        id: "ecommerce-modules",
        type: "MODULE_LIST",
        title: { en: "Key modules", vi: "Module chính" },
        items: [
          {
            id: "cart-order",
            icon: "shopping_cart",
            title: { en: "Cart & Order Management", vi: "Quản lý giỏ hàng và đơn hàng" },
            description: {
              en: "Handles shopping cart state, order creation, and checkout-related backend flows.",
              vi: "Xử lý trạng thái giỏ hàng, tạo đơn hàng và các luồng backend liên quan checkout.",
            },
          },
          {
            id: "product-data",
            icon: "inventory_2",
            title: { en: "Product Data Management", vi: "Quản lý dữ liệu sản phẩm" },
            description: {
              en: "Organizes product catalog structures and product-related business data.",
              vi: "Tổ chức cấu trúc catalog sản phẩm và dữ liệu nghiệp vụ liên quan sản phẩm.",
            },
          },
          {
            id: "search",
            icon: "search",
            title: { en: "Product Search Optimization", vi: "Tối ưu tìm kiếm sản phẩm" },
            description: {
              en: "Improves product lookup and filtering for user-facing product discovery.",
              vi: "Cải thiện tìm kiếm và lọc sản phẩm cho trải nghiệm khám phá sản phẩm.",
            },
          },
          {
            id: "deployment",
            icon: "rocket_launch",
            title: { en: "Deployment & CI/CD", vi: "Triển khai & CI/CD" },
            description: {
              en: "Prepares repeatable Docker deployment with GitHub Actions and AWS EC2.",
              vi: "Chuẩn bị quy trình triển khai Docker lặp lại được với GitHub Actions và AWS EC2.",
            },
          },
        ],
      },
      {
        id: "ecommerce-ci-cd",
        type: "CI_CD_FLOW",
        title: { en: "Deployment pipeline", vi: "Pipeline triển khai" },
        steps: [
          { id: "push", label: { en: "Push to deployment branch", vi: "Push lên nhánh triển khai" } },
          { id: "actions", label: { en: "GitHub Actions build", vi: "GitHub Actions build" } },
          { id: "docker", label: { en: "Docker image build/push", vi: "Build/push Docker image" } },
          { id: "ec2", label: { en: "EC2 pull and restart service", vi: "EC2 pull image và restart service" } },
        ],
      },
      {
        id: "ecommerce-metrics",
        type: "METRIC_CARDS",
        title: { en: "Project highlights", vi: "Điểm nổi bật dự án" },
        metrics: [
          { id: "architecture", label: { en: "Architecture", vi: "Kiến trúc" }, value: "Clean Architecture" },
          { id: "deployment", label: { en: "Deployment", vi: "Triển khai" }, value: "Docker + AWS EC2" },
          { id: "scope", label: { en: "Scope", vi: "Phạm vi" }, value: "Backend + Admin + Client" },
        ],
      },
      {
        id: "ecommerce-links",
        type: "LINK_GROUP",
        title: { en: "Repository links", vi: "Liên kết repository" },
        links: [],
      },
    ],
  },
];

export const achievements: Achievement[] = [
  {
    id: "thesis-score",
    icon: "verified",
    title: {
      en: "Graduation Thesis Score: 10/10",
      vi: "Điểm khóa luận tốt nghiệp: 10/10",
    },
    description: {
      en: "Achieved a final thesis score of 10/10 for Leafy – AIoT Smart Agriculture Platform.",
      vi: "Đạt điểm khóa luận tốt nghiệp 10/10 với đề tài Leafy – Nền tảng nông nghiệp thông minh AIoT.",
    },
  },
  {
    id: "promising-award",
    icon: "emoji_events",
    title: {
      en: "Promising Award",
      vi: "Giải Triển vọng",
    },
    description: {
      en: "Received the Promising Award at the Faculty-level Student Scientific Conference.",
      vi: "Nhận Giải Triển vọng tại Hội nghị Sinh viên Nghiên cứu Khoa học cấp Khoa.",
    },
  },
  {
    id: "early-completion",
    icon: "timeline",
    title: {
      en: "Completed One Semester Early",
      vi: "Hoàn thành sớm một học kỳ",
    },
    description: {
      en: "Completed the graduation thesis one semester earlier than the standard academic schedule.",
      vi: "Hoàn thành khóa luận tốt nghiệp sớm hơn một học kỳ so với tiến độ học tập tiêu chuẩn.",
    },
  },
];

export const certificates: Certificate[] = [
  {
    id: "toeic-preparation",
    icon: "school",
    title: { en: "TOEIC Preparation", vi: "Ôn luyện TOEIC" },
    issuer: { en: "Self-study / preparation", vi: "Tự học / ôn luyện" },
    description: {
      en: "Learning and preparation item for English proficiency. This is not an official issued certificate.",
      vi: "Mục học tập và ôn luyện năng lực tiếng Anh. Đây không phải chứng chỉ chính thức đã được cấp.",
    },
    kind: "preparation",
    official: false,
  },
  {
    id: "backend-learning-path",
    icon: "developer_mode",
    title: { en: "Backend Development Learning Path", vi: "Lộ trình học Backend Development" },
    issuer: { en: "Learning path", vi: "Lộ trình học tập" },
    description: {
      en: "Practice-oriented backend learning item covering Java, Spring Boot, APIs, and database fundamentals.",
      vi: "Mục học tập thực hành backend với Java, Spring Boot, API và nền tảng cơ sở dữ liệu.",
    },
    kind: "learning",
    official: false,
  },
  {
    id: "cloud-deployment-practice",
    icon: "cloud_done",
    title: { en: "Cloud & Deployment Practice", vi: "Thực hành Cloud & Deployment" },
    issuer: { en: "Project practice", vi: "Thực hành qua dự án" },
    description: {
      en: "Practice item for Docker, GitHub Actions, Docker Hub, AWS EC2, and deployment workflows.",
      vi: "Mục thực hành Docker, GitHub Actions, Docker Hub, AWS EC2 và quy trình triển khai.",
    },
    kind: "practice",
    official: false,
  },
];

export const blogPosts: BlogPost[] = [
  {
    id: "leafy-alert-workflow",
    slug: "how-i-built-leafy-iot-alert-workflow",
    title: {
      en: "How I Built the IoT Alert Workflow in Leafy",
      vi: "Cách tôi xây dựng luồng cảnh báo IoT trong Leafy",
    },
    summary: {
      en: "A technical note about turning ESP32 telemetry and sensor thresholds into farmer-facing alert events.",
      vi: "Ghi chú kỹ thuật về cách chuyển dữ liệu ESP32 và ngưỡng cảm biến thành sự kiện cảnh báo cho nông dân.",
    },
    content: {
      en: "## IoT alert workflow\n\nThe Leafy alert workflow starts with ESP32 telemetry, validates readings on the backend, compares values with configured thresholds, then records alert events for dashboards and notifications.",
      vi: "## Luồng cảnh báo IoT\n\nLuồng cảnh báo trong Leafy bắt đầu từ dữ liệu ESP32, backend kiểm tra dữ liệu, so sánh giá trị với ngưỡng cấu hình, sau đó ghi nhận sự kiện cảnh báo cho dashboard và thông báo.",
    },
    tags: ["IoT", "Spring Boot", "MQTT", "Alerting"],
    publishedAt: "2026-06-01",
    readingTimeMinutes: 5,
    featured: true,
  },
  {
    id: "spring-clean-architecture",
    slug: "clean-architecture-spring-boot-ecommerce",
    title: {
      en: "Applying Clean Architecture in a Spring Boot E-commerce System",
      vi: "Áp dụng Clean Architecture trong hệ thống thương mại điện tử Spring Boot",
    },
    summary: {
      en: "How modular boundaries and clean layering helped organize backend logic in an e-commerce project.",
      vi: "Cách ranh giới module và phân lớp rõ ràng giúp tổ chức logic backend trong dự án thương mại điện tử.",
    },
    content: {
      en: "## Clean Architecture with Spring Boot\n\nThe project separates controller, application, domain, and infrastructure responsibilities so core business rules stay easier to test and maintain.",
      vi: "## Clean Architecture với Spring Boot\n\nDự án tách trách nhiệm controller, application, domain và infrastructure để business rules dễ kiểm thử và bảo trì hơn.",
    },
    tags: ["Java", "Spring Boot", "Clean Architecture"],
    publishedAt: "2026-05-20",
    readingTimeMinutes: 6,
    featured: true,
  },
  {
    id: "spring-docker-ec2",
    slug: "deploying-spring-boot-docker-aws-ec2",
    title: {
      en: "Deploying a Spring Boot Backend with Docker and AWS EC2",
      vi: "Triển khai backend Spring Boot với Docker và AWS EC2",
    },
    summary: {
      en: "A concise deployment workflow using Docker images, Docker Hub, GitHub Actions, and AWS EC2.",
      vi: "Quy trình triển khai ngắn gọn với Docker image, Docker Hub, GitHub Actions và AWS EC2.",
    },
    content: {
      en: "## Docker and EC2 deployment\n\nA practical deployment flow can build the Spring Boot artifact, package it as a Docker image, push it to Docker Hub, then let EC2 pull and restart the service.",
      vi: "## Triển khai với Docker và EC2\n\nMột luồng triển khai thực tế có thể build artifact Spring Boot, đóng gói thành Docker image, push lên Docker Hub, sau đó EC2 pull image và restart service.",
    },
    tags: ["Docker", "AWS EC2", "CI/CD"],
    publishedAt: "2026-05-10",
    readingTimeMinutes: 4,
    featured: false,
  },
];

export const contactLinks: ContactLink[] = [
  {
    id: "email",
    type: "email",
    icon: "mail",
    label: { en: "Email", vi: "Email" },
    href: `mailto:${profile.email}`,
    value: profile.email,
  },
  {
    id: "github",
    type: "github",
    icon: "code",
    label: { en: "GitHub", vi: "GitHub" },
    href: profile.githubUrl,
    value: "github.com/HaoLe2710",
  },
  {
    id: "linkedin",
    type: "linkedin",
    icon: "work",
    label: { en: "LinkedIn", vi: "LinkedIn" },
    href: profile.linkedInUrl,
    value: "Available on request",
  },
  {
    id: "cv",
    type: "cv",
    icon: "description",
    label: { en: "Download CV", vi: "Tải CV" },
    href: profile.cvUrl,
    value: profile.cvUrl,
  },
];

export const siteSettings: SiteSettings = {
  siteName: "Hao.dev",
  authorName: "Le Ngoc Hao",
  defaultLocale: "en",
  supportedLocales: ["en", "vi"],
};

projects.forEach((project) => {
  project.contentBlocks.forEach((block) => {
    if (block.type === "LINK_GROUP") {
      block.links = project.links;
    }
  });
});

export const mockPortfolio = {
  profile,
  skillGroups,
  projects,
  achievements,
  certificates,
  blogPosts,
  contactLinks,
  siteSettings,
};
