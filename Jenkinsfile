pipeline {
     agent any

     environment {
	POSTGRES_DB = 'leap_frogs_mock'
	POSTGRES_USER = 'postgres'
	// Requires a Jenkins "Secret text" credential named db-postgres-password.
	POSTGRES_PASSWORD = credentials('db-postgres-password')
     }

     stages {
	stage('Checkout') {
	     steps {
		checkout scm 
	     }
	}

	stage('Build Image') {
	     steps {
		sh 'mvn -B package -DskipTests'
		sh 'docker build -t team-skeleton:${BUILD_NUMBER} .'
	     }
	}

	stage('Test') {
	    steps {
		sh 'mvn -B test'
	    }
	    post {
		always {
		   junit '**/target/surefire-reports/*.xml'
		}
	    }
	}

	stage('Start Database') {
	     steps {
		// Fresh volume so database/init/001_initialize.sql reruns migrations + seeds.
		sh 'docker compose down -v --remove-orphans'
		sh 'docker compose up -d postgres'
		sh '''
		    for i in $(seq 1 30); do
			if docker compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; then
			    echo "postgres is ready"
			    exit 0
			fi
			echo "waiting for postgres... ($i/30)"
			sleep 2
		    done
		    echo "postgres never became ready" >&2
		    docker compose logs postgres
		    exit 1
		'''
	     }
	}

	stage('Verify Migrations & Seeds') {
	     steps {
		sh '''
		    docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "\\dn"
		    docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM identity.clients;"
		'''
	     }
	}

	stage('Database Tests') {
	     steps {
		// database/tests is mounted read-only at /database/tests inside the container.
		sh 'docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /database/tests/database_tests.sql'
	     }
	}
    }

    post {
	always {
	    sh 'docker compose down -v --remove-orphans || true'
	}
    }
}
