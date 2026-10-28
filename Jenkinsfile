pipeline {
     agent any

	options {
		timestamps()
		disableConcurrentBuilds()
		skipDefaultCheckout(true)
	}

	parameters {
		booleanParam(
			name: 'PUBLISH_IMAGE',
			defaultValue: false,
			description: 'Push the verified API image for main or a tag. Configure the docker-registry Jenkins credential first.'
		)
		string(
			name: 'IMAGE_REPOSITORY',
			defaultValue: '',
			description: 'Full image repository, e.g. ghcr.io/acme/leap-frogs-api. Required only when publishing.'
		)
	}

	environment {
		DB_HOST = '127.0.0.1'
		DB_USER = 'postgres'
		DB_OPERATIONAL_NAME = 'leapfrogsdb'
		DB_ANALYTICS_NAME = 'leap_analytics'
		POSTGRES_DB = 'leap_analytics'
		POSTGRES_USER = 'postgres'
		CI_PG_CONTAINER = ''
	}

	stages {
		stage('Checkout') {
			steps {
				checkout scm
			}
		}

		stage('Backend Verify') {
			steps {
				script {
					env.CI_PG_CONTAINER = "leap-ci-${env.BUILD_TAG}".replaceAll(/[^A-Za-z0-9_.-]/, '-').take(120)
				}
				sh '''
					docker run --detach \\
					  --name "$CI_PG_CONTAINER" \\
					  --env POSTGRES_DB=leapfrogsdb \\
					  --env POSTGRES_USER="$DB_USER" \\
					  --env POSTGRES_HOST_AUTH_METHOD=trust \\
					  --publish 127.0.0.1::5432 \\
					  --volume "$WORKSPACE/database/create-analytics-database.sql:/docker-entrypoint-initdb.d/1-create-analytics-database.sql:ro" \\
					  --volume "$WORKSPACE/database/capstone-mvp-schema.sql:/docker-entrypoint-initdb.d/2-load-operational-schema.sql:ro" \\
					  --volume "$WORKSPACE/database/copy-trading-schema.sql:/docker-entrypoint-initdb.d/3-copy-trading-schema.sql:ro" \\
					  --volume "$WORKSPACE/database/rbac-schema.sql:/docker-entrypoint-initdb.d/4-rbac-schema.sql:ro" \\
					  --volume "$WORKSPACE/database/rbac-seed.sql:/docker-entrypoint-initdb.d/5-rbac-seed.sql:ro" \\
					  --volume "$WORKSPACE/database/cash-deposits.sql:/docker-entrypoint-initdb.d/5b-cash-deposits.sql:ro" \\
					  --volume "$WORKSPACE/database/cash-withdrawals.sql:/docker-entrypoint-initdb.d/5c-cash-withdrawals.sql:ro" \\
					  --volume "$WORKSPACE/database/more-instruments.sql:/docker-entrypoint-initdb.d/5d-more-instruments.sql:ro" \\
					  --volume "$WORKSPACE/database/load-analytics-schema.sh:/docker-entrypoint-initdb.d/6-load-analytics-schema.sh:ro" \\
					  --volume "$WORKSPACE/database/capstone-analytics-schema.sql:/analytics-schema.sql:ro" \\
					  postgres:16

					for attempt in $(seq 1 60); do
					  if docker exec "$CI_PG_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_OPERATIONAL_NAME" >/dev/null 2>&1; then
						break
					  fi
					  if [ "$attempt" -eq 60 ]; then
						docker logs "$CI_PG_CONTAINER"
						exit 1
					  fi
					  sleep 2
					done

					DB_PORT=$(docker port "$CI_PG_CONTAINER" 5432/tcp | sed 's/.*://')
					echo "Using ephemeral PostgreSQL port $DB_PORT"
					echo "DB_PORT=$DB_PORT" >> "$WORKSPACE/.ci-db.env"
				'''
				script {
					def dbPort = readFile('.ci-db.env').trim().split('=', 2)[1]
					withEnv(["DB_PORT=${dbPort}"]) {
						withCredentials([string(
							credentialsId: 'leap-demo-password',
							variable: 'LEAP_DEMO_PASSWORD'
						)]) {
							sh 'mvn -B verify'
						}
					}
				}
			}
		}

		stage('UI Build') {
			steps {
				dir('ui') {
					sh 'npm ci --no-audit --no-fund'
					sh 'npm run build'
				}
			}
		}

		stage('Python Tests') {
			steps {
				sh '''
					python3 -m venv .venv-ci
					. .venv-ci/bin/activate
					python -m pip install --disable-pip-version-check -r etl/requirements-etl.txt matplotlib
					python -m compileall -q etl visualizations
					PYTHONPATH=visualizations python -m unittest discover -s visualizations -p 'test_*.py'
				'''
			}
		}

		stage('Build API Image') {
			steps {
				sh 'docker build --pull -t leap-frogs-api:${GIT_COMMIT} .'
			}
		}

		stage('Publish API Image') {
			when {
				expression {
					params.PUBLISH_IMAGE &&
					(env.BRANCH_NAME == 'main' || env.TAG_NAME)
				}
			}
			steps {
				script {
					if (!params.IMAGE_REPOSITORY?.trim()) {
						error 'Set IMAGE_REPOSITORY before publishing the API image.'
					}
					def releaseTag = (env.TAG_NAME ?: env.GIT_COMMIT)
						.replaceAll(/[^A-Za-z0-9_.-]/, '-')
					def registry = params.IMAGE_REPOSITORY.tokenize('/')[0]
					if (!registry.contains('.') && !registry.contains(':')) {
						registry = 'https://index.docker.io/v1/'
					}
					withEnv([
						"REGISTRY_HOST=${registry}",
						"IMAGE_REPOSITORY=${params.IMAGE_REPOSITORY}",
						"RELEASE_TAG=${releaseTag}"
					]) {
						withCredentials([usernamePassword(
							credentialsId: 'docker-registry',
							usernameVariable: 'REGISTRY_USER',
							passwordVariable: 'REGISTRY_PASSWORD'
						)]) {
							sh '''
								set +x
								trap 'docker logout "$REGISTRY_HOST" >/dev/null 2>&1 || true' EXIT
								printf '%s' "$REGISTRY_PASSWORD" | docker login "$REGISTRY_HOST" --username "$REGISTRY_USER" --password-stdin
								docker tag "leap-frogs-api:$GIT_COMMIT" "$IMAGE_REPOSITORY:$RELEASE_TAG"
								docker push "$IMAGE_REPOSITORY:$RELEASE_TAG"
							'''
						}
					}
				}
			}
		}
	}

	post {
		always {
			junit allowEmptyResults: true, testResults: '**/target/surefire-reports/*.xml'
			sh '''
				if [ -n "$CI_PG_CONTAINER" ]; then
				  docker logs "$CI_PG_CONTAINER" > postgres-ci.log 2>&1 || true
				  docker rm --force "$CI_PG_CONTAINER" >/dev/null 2>&1 || true
				fi
			'''
			archiveArtifacts allowEmptyArchive: true, artifacts: 'postgres-ci.log,ui/dist/**'
			cleanWs()
		}
	}
}
