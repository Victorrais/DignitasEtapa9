package br.com.dignitas.web.config;

import br.com.dignitas.persistence.Jpa;
import br.com.dignitas.persistence.SchemaInstaller;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Liga o núcleo ao banco configurado: cria o esquema (idempotente) e inicializa o JPA.
 * O núcleo não conhece Spring; esta é a única ponte entre os dois.
 */
@Component
public class BancoDeDados implements InitializingBean, DisposableBean {

    private final String url;
    private final String usuario;
    private final String senha;
    private final String driver;

    public BancoDeDados(@Value("${dignitas.db.url}") String url,
                        @Value("${dignitas.db.usuario}") String usuario,
                        @Value("${dignitas.db.senha:}") String senha,
                        @Value("${dignitas.db.driver}") String driver) {
        this.url = url;
        this.usuario = usuario;
        this.senha = senha;
        this.driver = driver;
    }

    @Override
    public void afterPropertiesSet() throws Exception {
        SchemaInstaller.install(url, usuario, senha);
        Map<String, Object> props = new HashMap<>();
        props.put("jakarta.persistence.jdbc.driver", driver);
        props.put("jakarta.persistence.jdbc.url", url);
        props.put("jakarta.persistence.jdbc.user", usuario);
        props.put("jakarta.persistence.jdbc.password", senha);
        Jpa.init(props);
    }

    @Override
    public void destroy() {
        Jpa.shutdown();
    }
}
