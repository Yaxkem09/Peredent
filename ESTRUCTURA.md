# Estructura del proyecto

Peredent es una aplicación de gestión para clínicas dentales, compuesta por un backend en ASP.NET Core (C#) y un frontend en React (Vite). Incluye módulos de autenticación, pacientes, citas e inventario.

```
Peredent/
├── .github/
│   └── workflows/
│       ├── ci-backend.yml      # Pipeline de CI para el backend
│       └── ci-frontend.yml     # Pipeline de CI para el frontend
│
├── backend/                    # API en ASP.NET Core
│   ├── Controllers/            # Endpoints HTTP
│   │   ├── AuthController.cs
│   │   ├── CitasController.cs
│   │   ├── HealthController.cs
│   │   ├── InventarioController.cs
│   │   └── PacientesController.cs
│   ├── Data/                   # Acceso a datos / EF Core
│   │   ├── ApplicationDbContext.cs
│   │   └── DbInitializer.cs
│   ├── DTOs/
│   │   ├── Request/            # DTOs de entrada (create/login/etc.)
│   │   │   ├── CreateCitaDto.cs
│   │   │   ├── CreatePacienteDto.cs
│   │   │   ├── CreateUsuarioDto.cs
│   │   │   ├── LoginDto.cs
│   │   │   └── RefreshTokenDto.cs
│   │   └── Response/           # DTOs de salida
│   │       ├── ApiResponseDto.cs
│   │       ├── AuthResponseDto.cs
│   │       ├── CitaDto.cs
│   │       ├── PacienteDto.cs
│   │       └── UsuarioDto.cs
│   ├── Models/                 # Entidades de dominio
│   │   ├── Cita.cs
│   │   ├── Inventario.cs
│   │   ├── Paciente.cs
│   │   └── Usuario.cs
│   ├── Repositories/           # Patrón Repository / Unit of Work
│   │   ├── CitaRepository.cs
│   │   ├── ICitaRepository.cs
│   │   ├── IPacienteRepository.cs
│   │   ├── IRepository.cs
│   │   ├── IUnitOfWork.cs
│   │   ├── PacienteRepository.cs
│   │   ├── Repository.cs
│   │   └── UnitOfWork.cs
│   ├── Services/                # Lógica de negocio
│   │   ├── AuthService.cs / IAuthService.cs
│   │   ├── CitaService.cs / ICitaService.cs
│   │   ├── EmailService.cs / IEmailService.cs
│   │   ├── InventarioService.cs / IInventarioService.cs
│   │   └── PacienteService.cs / IPacienteService.cs
│   ├── Tests/
│   │   └── UnitTests/
│   │       └── Services/
│   │           ├── AuthServiceTests.cs
│   │           └── CitaServiceTests.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   └── Program.cs              # Punto de entrada de la API
│
├── frontend/                    # SPA en React + Vite
│   ├── src/
│   │   ├── __tests__/           # Pruebas (hooks, services)
│   │   │   ├── hooks/useAuth.test.js
│   │   │   ├── services/auth.service.test.js
│   │   │   └── setup.js
│   │   ├── components/
│   │   │   ├── common/          # Alert, Button, Loader, Modal
│   │   │   └── layout/          # Footer, Navbar, Sidebar
│   │   ├── context/             # AuthContext, NotificationContext
│   │   ├── hooks/                # useAuth, useDebounce, useFetch, useForm, useLocalStorage, useMutation
│   │   ├── layouts/              # AuthLayout, MainLayout
│   │   ├── pages/
│   │   │   ├── Calendario/
│   │   │   ├── Dashboard/
│   │   │   ├── Inventario/
│   │   │   ├── Login/
│   │   │   └── Pacientes/       # Detail, Form, List
│   │   ├── routes/               # ProtectedRoute, routes.js
│   │   ├── services/             # api.js, auth/citas/inventario/pacientes.service.js
│   │   ├── utils/                # constants, formatters, logger, validators
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── jest.config.js
│   ├── package.json
│   └── vite.config.js
│
├── .env.example
├── docker-compose.yml            # Servicios: SQL Server, Redis, backend, frontend
├── CONTRIBUTING.md
└── README.md
```

## Resumen por capa

- **backend/Controllers** — expone los endpoints REST (auth, citas, pacientes, inventario, health).
- **backend/Services** — contiene la lógica de negocio, cada una con su interfaz para inyección de dependencias.
- **backend/Repositories** — abstrae el acceso a datos siguiendo el patrón Repository + Unit of Work.
- **backend/Models** — entidades de dominio mapeadas por Entity Framework Core.
- **backend/DTOs** — separan los contratos de entrada (`Request`) y salida (`Response`) de la API.
- **backend/Tests** — pruebas unitarias de los servicios.
- **frontend/src/pages** — vistas principales de la aplicación (Dashboard, Pacientes, Citas/Calendario, Inventario, Login).
- **frontend/src/components** — componentes reutilizables (comunes y de layout).
- **frontend/src/services** — capa de comunicación con la API del backend.
- **frontend/src/hooks / context** — estado y lógica compartida (autenticación, notificaciones, formularios, fetch).

## Infraestructura y CI/CD

- `docker-compose.yml` orquesta SQL Server, Redis, backend y frontend.
- `.github/workflows/` define pipelines de integración continua separados para backend y frontend.
