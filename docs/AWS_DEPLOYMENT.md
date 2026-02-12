# Инструкция по развертыванию на AWS

## Вариант 1: AWS Elastic Beanstalk (Рекомендуется)

### Преимущества:
- ✅ Простое развертывание
- ✅ Автоматическое масштабирование
- ✅ Мониторинг и логи
- ✅ SSL сертификаты через AWS Certificate Manager

### Шаги:

1. **Установите EB CLI:**
```bash
pip install awsebcli
eb --version
```

2. **Инициализируйте проект:**
```bash
eb init
# Выберите регион, платформу Node.js 20
```

3. **Создайте окружение:**
```bash
eb create aida-production
```

4. **Настройте переменные окружения:**
```bash
eb setenv DATABASE_URL="postgresql://user:pass@rds-endpoint:5432/db?sslmode=require"
eb setenv JWT_SECRET="your-secret"
eb setenv JWT_REFRESH_SECRET="your-refresh-secret"
eb setenv PORT=8080
eb setenv NODE_ENV=production
```

5. **Деплой:**
```bash
eb deploy
eb open  # Откроет приложение в браузере
```

---

## Вариант 2: AWS EC2

### Преимущества:
- ✅ Полный контроль
- ✅ Гибкая настройка
- ✅ Дешевле для небольших проектов

### Шаги:

1. **Создайте EC2 инстанс** (Ubuntu 22.04 или Amazon Linux 2023)

2. **Подключитесь и установите зависимости:**
```bash
ssh -i key.pem ec2-user@your-ip

# Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# PM2
npm install -g pm2

# PostgreSQL client
sudo yum install postgresql15 -y  # Amazon Linux
```

3. **Клонируйте и настройте:**
```bash
git clone https://github.com/Hukumishe/AIDA_project.git
cd AIDA_project
npm install

# Создайте .env
nano .env
# DATABASE_URL=...
# JWT_SECRET=...
# PORT=3000
```

4. **Примените миграции и запустите:**
```bash
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 start npm --name "aida" -- run start:prod
pm2 save
pm2 startup
```

---

## Вариант 3: Docker + ECS/Fargate

### Преимущества:
- ✅ Контейнеризация
- ✅ Легкое масштабирование
- ✅ Изоляция окружения

### Шаги:

1. **Соберите Docker образ:**
```bash
docker build -t aida-backend .
```

2. **Создайте ECR репозиторий:**
```bash
aws ecr create-repository --repository-name aida-backend
```

3. **Загрузите образ:**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com
docker tag aida-backend:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/aida-backend:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/aida-backend:latest
```

4. **Создайте ECS кластер и сервис через AWS Console**

---

## Настройка базы данных

После создания RDS PostgreSQL:

1. **Обновите DATABASE_URL:**
```
postgresql://username:password@rds-endpoint:5432/database?sslmode=require
```

2. **Примените миграции:**
```bash
DATABASE_URL="..." npx prisma migrate deploy
```

---

## Настройка домена и SSL

### Elastic Beanstalk:
1. AWS Console → Elastic Beanstalk → Configuration
2. Load balancer → Add listener (HTTPS, порт 443)
3. SSL Certificate → Выберите сертификат из ACM

### EC2:
1. Установите Certbot:
```bash
sudo yum install certbot python3-certbot-nginx -y
```

2. Получите сертификат:
```bash
sudo certbot --nginx -d your-domain.com
```

---

## Мониторинг

### CloudWatch:
- Логи приложения
- Метрики CPU, памяти
- Алерты

### PM2 (для EC2):
```bash
pm2 monit
pm2 logs
```

---

## Резервное копирование

### RDS:
- Автоматические снимки
- Настройте retention period в RDS Console

### Приложение:
```bash
# Создайте скрипт бэкапа
#!/bin/bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
aws s3 cp backup-*.sql s3://your-backup-bucket/
```

---

## Стоимость (примерная)

- **RDS PostgreSQL (db.t3.micro):** ~$15-20/месяц
- **EC2 (t3.small):** ~$15-20/месяц
- **Elastic Beanstalk:** бесплатно (платите только за EC2)
- **ECS Fargate:** ~$30-40/месяц
- **Data Transfer:** первые 100GB бесплатно

---

## Полезные команды

```bash
# Elastic Beanstalk
eb status
eb logs
eb ssh
eb terminate  # Удалить окружение

# EC2 + PM2
pm2 restart aida
pm2 logs aida
pm2 stop aida

# Prisma
npx prisma migrate deploy
npx prisma studio  # Локально для просмотра данных
```




