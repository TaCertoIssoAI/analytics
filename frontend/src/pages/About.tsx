import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Github, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const About = () => {
  const team = [
    {
      name: "Caue Paiva Lira",
      role: "Desenvolvedor",
      photo: "https://media.licdn.com/dms/image/v2/D4D03AQFjIDBHEO3aoQ/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1701005815941?e=1766016000&v=beta&t=vdoGM59hdk8d_3pDAt4tflzqr3bG8oiVEjgfoT98ZUU",
      linkedin: "https://www.linkedin.com/in/cauepaiva/overlay/photo/",
      github: "https://github.com/caue-paiva",
    },
    {
      name: "Luiz Felipe Diniz Costa",
      role: "Desenvolvedor",
      photo: "https://media.licdn.com/dms/image/v2/D4D03AQHTD1JBPbZLrg/profile-displayphoto-shrink_800_800/B4DZdm0F_FG8Ac-/0/1749776623147?e=1766016000&v=beta&t=YwOwhFxByu-UfXq0NmUQuoJiuz0yf-tyK4Sd9WFQBAY",
      linkedin: "https://www.linkedin.com/in/lfelipediniz/",
      github: "https://github.com/lfelipediniz",
    },
    {
      name: "Pedro H. Ferreira Silva",
      role: "Desenvolvedor",
      photo: "https://media.licdn.com/dms/image/v2/D4D03AQFCc3e-AtVsig/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1723834226943?e=1766016000&v=beta&t=v276hxo_-I0DA1lt69nivkswPWj1F8M8veDChCMGS-8",
      linkedin: "https://www.linkedin.com/in/pedrohfsilva2/",
      github: "https://github.com/pedrohfsilva",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container py-12 max-w-4xl">
        <div className="space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Sobre o Projeto
            </h1>
            <p className="text-xl text-muted-foreground">
              Combatendo desinformação com inteligência artificial
            </p>
          </div>

          {/* Main Content */}
          <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-3xl font-bold mb-4">Tá Certo Isso AI?</h2>
              <p className="text-muted-foreground leading-relaxed">
                Nasceu como um bot de WhatsApp que usa inteligência artificial multimodal e APIs
                de fact-checking para combater a desinformação de forma rápida e acessível,
                diretamente dentro do aplicativo mais usado pelos brasileiros. A proposta é simples:
                permitir que qualquer pessoa, com poucos toques, possa verificar se uma mensagem
                recebida é verdadeira, enganosa ou fora de contexto <strong>sem precisar sair do WhatsApp</strong>,
                entender de política ou dominar técnicas jornalísticas.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Nosso público principal são pessoas que participam de grupos de família, amigos ou
                comunidades, especialmente aquelas com menor letramento midiático, pouco tempo para
                checar informações e alta dependência do app como fonte de informação diária. Sabemos
                que, nesse ambiente, o ritmo das mensagens é intenso e o apelo emocional das fake news
                dificulta a análise crítica. E mesmo quem quer verificar o conteúdo muitas vezes esbarra
                em ferramentas complexas, sites pesados e linguagens técnicas.
              </p>
            </section>

            <div className="flex justify-center py-4">
              <Button asChild size="lg" className="text-lg px-8">
                <Link to="/metodologia">Conheça nossa Metodologia</Link>
              </Button>
            </div>

            <section>
              <h3 className="text-2xl font-bold mb-4">Mas nosso projeto vai além da checagem individual.</h3>
              <p className="text-muted-foreground leading-relaxed">
                Estamos evoluindo o <strong>Tá Certo Isso AI</strong> para se tornar uma plataforma de
                dados poderosa. Com o grande volume de mensagens analisadas pelo nosso bot, sempre com
                os devidos cuidados de anonimização e mascaramento de conteúdo sensível, construiremos
                uma <strong>infraestrutura de analytics</strong> voltada para pesquisadores, jornalistas,
                instituições e organizações da sociedade civil. Essa plataforma web permitirá acompanhar
                padrões de desinformação, tendências temáticas, redes de disseminação e formatos mais
                recorrentes de fake news ao longo do tempo.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Imaginamos um ecossistema onde não só ajudamos pessoas a identificar notícias falsas no
                dia a dia, mas também <strong>geramos conhecimento estratégico</strong> para fortalecer
                a luta contra a desinformação em escala. Nossa hipótese é clara: ao democratizar tanto a
                verificação quanto o acesso às análises produzidas, ampliamos o impacto social do projeto,
                oferecendo uma solução tecnológica com potencial de intervenção imediata e valor científico
                a longo prazo.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Assim, <strong>Tá Certo Isso AI</strong> se torna mais do que um bot. É uma ponte entre o
                cotidiano da informação digital e os bastidores da produção de conhecimento sobre ela.
              </p>
            </section>
          </div>

          {/* Team Section */}
          <section className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">Nossa Equipe</h2>
              <p className="text-muted-foreground">
                Conheça as pessoas por trás do projeto
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {team.map((member, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div className="w-32 h-32 rounded-full overflow-hidden bg-muted">
                          <img
                            src={member.photo}
                            alt={member.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="text-center space-y-1">
                        <h3 className="font-semibold text-lg">{member.name}</h3>
                        <p className="text-sm text-muted-foreground">{member.role}</p>
                      </div>
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          asChild
                        >
                          <a
                            href={member.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Linkedin className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          asChild
                        >
                          <a
                            href={member.github}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Github className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default About;
