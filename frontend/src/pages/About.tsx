import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Github, Linkedin, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const About = () => {
  const team = [
    {
      name: "Caue Paiva Lira",
      role: "Desenvolvedor",
      photo: "https://avatars.githubusercontent.com/u/128509727?v=4",
      linkedin: "https://www.linkedin.com/in/cauepaiva/overlay/photo/",
      github: "https://github.com/caue-paiva",
    },
    {
      name: "Luiz Felipe Diniz Costa",
      role: "Desenvolvedor",
      photo: "https://avatars.githubusercontent.com/u/61145881?v=4",
      linkedin: "https://www.linkedin.com/in/lfelipediniz/",
      github: "https://github.com/lfelipediniz",
    },
    {
      name: "Pedro H. Ferreira Silva",
      role: "Desenvolvedor",
      photo: "https://avatars.githubusercontent.com/u/61637621?v=4",
      linkedin: "https://www.linkedin.com/in/pedrohfsilva2/",
      github: "https://github.com/pedrohfsilva",
    },
    {
      name: "Matheu Alves",
      role: "Marketing/Comunicação",
      photo: "https://avatars.githubusercontent.com/u/177944722?v=4",
      linkedin: "https://www.linkedin.com/in/matheu-alves/",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container pt-10 md:pt-14 pb-6 md:pb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Info className="h-6 w-6 text-primary" />
            </div>
            <span className="text-sm uppercase tracking-wider text-muted-foreground font-medium">
              Sobre o projeto
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight max-w-3xl">
            Combatendo desinformação com <span className="text-primary">inteligência artificial</span>
          </h1>
          <p className="text-lg text-muted-foreground mt-4 max-w-3xl">
            Conheça a história, a equipe e os valores por trás do Tá Certo Isso AI?
          </p>
        </div>
      </section>

      <div className="container pt-4 pb-8">
        <div className="space-y-10">
          <div className="flex justify-center">
            <div className="relative w-full max-w-2xl aspect-[16/9] overflow-hidden rounded-lg">
              <iframe
                className="absolute inset-0 h-full w-full rounded-lg"
                src="https://www.youtube.com/embed/15tRUpSGfhI?cc_load_policy=1&cc_lang_pref=pt"
                title="Demonstração Tá Certo Isso AI"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
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
              <Button asChild size="lg" variant="outline" className="text-lg px-8">
                <Link to="/metodologia" className="text-foreground">
                  Conheça nossa Metodologia
                </Link>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                        {member.github && (
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
                        )}
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
