package br.com.dignitas.web;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Ponto de entrada da aplicação web. O front-end estático é servido de src/main/resources/static. */
@SpringBootApplication
public class DignitasWebApplication {

    public static void main(String[] args) {
        SpringApplication.run(DignitasWebApplication.class, args);
    }
}
