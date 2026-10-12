# Dignitas — Etapa 9

Sistema web do Dignitas: API REST em Spring Boot sobre o núcleo de regras, com banco MySQL (JPA/Hibernate)
e o front-end em HTML, CSS e JavaScript.

## Módulos

| Módulo | Conteúdo |
|---|---|
| `core/` | Regras de negócio (sem interface nem Spring): domínio, serviços, persistência e extração de PDF |
| `web/` | Aplicação Spring Boot: API REST e front-end estático em `web/src/main/resources/static` |

## Como executar

1. Inicie o MySQL 8 e defina a senha, se houver:

   ```bash
   set DIGNITAS_DB_SENHA=sua-senha
   ```

2. Compile e teste tudo:

   ```bash
   ./mvnw -B test
   ```

3. Rode a aplicação e abra http://localhost:8080:

   ```bash
   ./mvnw -B -pl web -am spring-boot:run
   ```

O esquema do banco (`core/src/main/resources/sql/schema.sql`) é criado na inicialização, sem apagar dados.

## Configuração

Propriedades em `web/src/main/resources/application.yml`; podem ser sobrescritas por variável de ambiente
ou por argumentos da linha de comando (`--dignitas.db.url=...`).

## Testes

- `core/src/test`: testes unitários JUnit das regras (sem banco).
- `web/src/test`: testes de API com MockMvc, usando H2 em modo MySQL (perfil `test`).
- Testes manuais das telas: ver o documento de evidências da Etapa 9.
